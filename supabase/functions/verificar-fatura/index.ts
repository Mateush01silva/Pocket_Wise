import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// CORS
// ============================================================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ============================================================================
// CONSTANTS
// ============================================================================

const OPENAI_MODEL = 'gpt-4o-mini'

// ============================================================================
// TYPES
// ============================================================================

interface TransacaoSimples {
  data: string
  descricao: string
  valor: number
  parcela?: string
}

interface PDFTransacao {
  data: string
  descricao: string
  valor: number
}

interface PDFExtracao {
  total_pdf: number | null
  transacoes: PDFTransacao[]
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getCurrentMes(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getRenovacaoDate(mesAtual: string): string {
  const [ano, mes] = mesAtual.split('-').map(Number)
  const dataRenovacao = new Date(ano, mes, 1)
  return dataRenovacao.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

// ---------------------------------------------------------------------------
// Value-based matching: deterministic, no AI name confusion
// ---------------------------------------------------------------------------
function matchTransacoes(
  appItems: TransacaoSimples[],
  pdfItems: PDFTransacao[],
): {
  no_pdf_nao_no_app: PDFTransacao[]
  no_app_nao_no_pdf: TransacaoSimples[]
} {
  const appPool = appItems.map((item) => ({ item, matched: false }))
  const pdfPool = pdfItems.map((item) => ({ item, matched: false }))

  // Greedy value-based matching (tolerance: R$0.10 for rounding)
  for (const pdfEntry of pdfPool) {
    const idx = appPool.findIndex(
      (a) => !a.matched && Math.abs(a.item.valor - pdfEntry.item.valor) < 0.10,
    )
    if (idx !== -1) {
      appPool[idx].matched = true
      pdfEntry.matched = true
    }
  }

  return {
    no_pdf_nao_no_app: pdfPool.filter((e) => !e.matched).map((e) => e.item),
    no_app_nao_no_pdf: appPool.filter((e) => !e.matched).map((e) => e.item),
  }
}

function gerarResumo(params: {
  noPdfNaoNoApp: PDFTransacao[]
  noAppNaoNoPdf: TransacaoSimples[]
  totalPdf: number | null
  totalApp: number
  diferencaTotal: number | null
}): string {
  const { noPdfNaoNoApp, noAppNaoNoPdf, totalPdf, totalApp, diferencaTotal } = params
  const partes: string[] = []

  if (diferencaTotal !== null) {
    if (Math.abs(diferencaTotal) < 0.10) {
      partes.push(`Os totais conferem: ambos somam ${formatBRL(totalApp)}.`)
    } else if (diferencaTotal > 0) {
      partes.push(
        `O total do PDF (${formatBRL(totalPdf!)}) é ${formatBRL(diferencaTotal)} maior que o registrado no app (${formatBRL(totalApp)}).`,
      )
    } else {
      partes.push(
        `O total do PDF (${formatBRL(totalPdf!)}) é ${formatBRL(Math.abs(diferencaTotal))} menor que o registrado no app (${formatBRL(totalApp)}).`,
      )
    }
  }

  if (noPdfNaoNoApp.length === 0 && noAppNaoNoPdf.length === 0) {
    partes.push('Todos os lançamentos conferem perfeitamente.')
  } else {
    if (noPdfNaoNoApp.length > 0) {
      partes.push(
        `${noPdfNaoNoApp.length} lançamento(s) da fatura não ${noPdfNaoNoApp.length === 1 ? 'está registrado' : 'estão registrados'} no app.`,
      )
    }
    if (noAppNaoNoPdf.length > 0) {
      partes.push(
        `${noAppNaoNoPdf.length} lançamento(s) do app não ${noAppNaoNoPdf.length === 1 ? 'foi encontrado' : 'foram encontrados'} na fatura PDF.`,
      )
    }
  }

  return partes.join(' ')
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // -------------------------------------------------------------------------
    // 1. AUTENTICAÇÃO
    // -------------------------------------------------------------------------
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return jsonResponse({ error: 'Token de autenticação não fornecido' }, 401)
    }

    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Usuário não autenticado' }, 401)
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // -------------------------------------------------------------------------
    // 2. VERIFICAR FEATURE FLAG
    // -------------------------------------------------------------------------
    let accessRecord = null

    const { data: accessByUid } = await supabaseAdmin
      .from('ai_feature_access')
      .select('id, user_id, email, enabled')
      .eq('user_id', user.id)
      .maybeSingle()

    if (accessByUid) {
      accessRecord = accessByUid
    } else {
      const userEmail = user.email ?? ''
      const { data: accessByEmail } = await supabaseAdmin
        .from('ai_feature_access')
        .select('id, user_id, email, enabled')
        .eq('email', userEmail)
        .maybeSingle()

      if (accessByEmail) {
        accessRecord = accessByEmail
        if (!accessByEmail.user_id) {
          await supabaseAdmin
            .from('ai_feature_access')
            .update({ user_id: user.id, updated_at: new Date().toISOString() })
            .eq('id', accessByEmail.id)
        }
      }
    }

    if (!accessRecord || !accessRecord.enabled) {
      return jsonResponse(
        { error: 'Acesso à IA não disponível para este usuário', code: 'FEATURE_NOT_ENABLED' },
        403
      )
    }

    // -------------------------------------------------------------------------
    // 3. VERIFICAR CRÉDITOS DISPONÍVEIS
    // -------------------------------------------------------------------------
    const mesAtual = getCurrentMes()

    const { data: creditsConfig } = await supabaseAdmin
      .from('ai_credits_config')
      .select('creditos_proativas')
      .eq('user_id', user.id)
      .maybeSingle()

    const creditosProativas = creditsConfig?.creditos_proativas ?? 10
    const TOTAL_LIMIT = 30
    const limiteManual = TOTAL_LIMIT - creditosProativas

    const { data: usageRows, error: usageErr } = await supabaseAdmin
      .from('ai_usage_log')
      .select('feature_type')
      .eq('user_id', user.id)
      .eq('mes_referencia', mesAtual)

    if (usageErr) {
      console.warn(`[verificar-fatura] falha ao ler usage_log (fail-open): ${usageErr.message}`)
    }

    const usadoManual = (usageRows ?? []).filter((r) => r.feature_type !== 'proativa').length

    if (usadoManual >= limiteManual) {
      return jsonResponse(
        {
          error: `Você atingiu o limite de ${limiteManual} consultas manuais este mês. Seus créditos renovam em ${getRenovacaoDate(mesAtual)}.`,
          code: 'MONTHLY_LIMIT_REACHED',
        },
        429
      )
    }

    // -------------------------------------------------------------------------
    // 4. LER BODY
    // -------------------------------------------------------------------------
    const body = await req.json()
    const { pdf_texto, transacoes, total_app, cartao_nome, periodo } = body as {
      pdf_texto: string
      transacoes: TransacaoSimples[]
      total_app: number
      cartao_nome: string
      periodo: string
    }

    if (!pdf_texto || typeof pdf_texto !== 'string' || pdf_texto.trim().length < 20) {
      return jsonResponse({ error: 'Texto do PDF inválido ou muito curto' }, 400)
    }

    if (!transacoes || !Array.isArray(transacoes)) {
      return jsonResponse({ error: 'Lista de transações inválida' }, 400)
    }

    // Limitar texto do PDF (~8k tokens, suficiente para extração)
    const pdfTextoLimitado = pdf_texto.length > 32000
      ? pdf_texto.substring(0, 32000) + '\n[... texto truncado por tamanho ...]'
      : pdf_texto

    // -------------------------------------------------------------------------
    // 5. PROMPT: SOMENTE EXTRAÇÃO DO PDF (sem comparação)
    //    A IA faz apenas o que faz bem: ler o texto e estruturar em JSON.
    //    O matching é feito em TypeScript (determinístico, por valor).
    // -------------------------------------------------------------------------
    const systemPrompt = `Você é um parser de documentos financeiros brasileiros. Extraia todas as transações desta fatura de cartão de crédito. Retorne SOMENTE JSON válido, sem markdown, sem texto adicional.`

    const userPrompt = `Extraia TODAS as transações individuais desta fatura de cartão de crédito.

REGRAS:
1. Cada linha de lançamento é uma transação SEPARADA — nunca agrupe por estabelecimento.
2. Para parcelas (ex: "Loja X 2/6"), cada parcela é uma transação individual.
3. "valor" deve ser número positivo (sem sinal negativo).
4. Inclua compras, tarifas, encargos, IOF, anuidades — tudo.
5. Ignore linhas de pagamento/crédito (valores que reduzem a fatura).

=== TEXTO DA FATURA PDF ===
${pdfTextoLimitado}

Retorne JSON com esta estrutura EXATA:
{
  "total_pdf": <número com o total/valor a pagar da fatura, ou null se não encontrado>,
  "transacoes": [
    {"data": "<data como aparece no PDF>", "descricao": "<nome do estabelecimento>", "valor": <número positivo>}
  ]
}`

    // -------------------------------------------------------------------------
    // 6. CHAMAR A API DA OPENAI
    // -------------------------------------------------------------------------
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('OPENAI_API_KEY não configurada')
      return jsonResponse({ error: 'Configuração de IA incompleta no servidor' }, 500)
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 8000,
        temperature: 0.0,
        response_format: { type: 'json_object' },
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('OpenAI error:', errText)
      return jsonResponse({ error: 'Erro ao consultar a IA. Tente novamente.' }, 502)
    }

    const openaiData = await openaiRes.json()
    const content = openaiData.choices?.[0]?.message?.content ?? ''

    if (!content) {
      return jsonResponse({ error: 'A IA não retornou uma resposta válida.' }, 502)
    }

    let extracao: PDFExtracao
    try {
      const jsonStart = content.indexOf('{')
      const jsonEnd = content.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
        throw new Error('no JSON object found')
      }
      extracao = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as PDFExtracao
      if (!Array.isArray(extracao.transacoes)) {
        extracao.transacoes = []
      }
    } catch {
      const finishReason = openaiData.choices?.[0]?.finish_reason
      console.error('Falha ao parsear extração da IA (finish_reason:', finishReason, '):', content.slice(0, 300))
      if (finishReason === 'length') {
        return jsonResponse({ error: 'O PDF é muito extenso para processar. Tente um período menor.' }, 502)
      }
      return jsonResponse({ error: 'Falha ao extrair transações do PDF. Tente novamente.' }, 502)
    }

    // -------------------------------------------------------------------------
    // 7. MATCHING POR VALOR (TypeScript, determinístico)
    // -------------------------------------------------------------------------
    const { no_pdf_nao_no_app, no_app_nao_no_pdf } = matchTransacoes(
      transacoes,
      extracao.transacoes,
    )

    const totalPdf = extracao.total_pdf ?? null
    const diferencaTotal = totalPdf !== null ? totalPdf - total_app : null

    const resumo = gerarResumo({
      noPdfNaoNoApp: no_pdf_nao_no_app,
      noAppNaoNoPdf: no_app_nao_no_pdf,
      totalPdf,
      totalApp: total_app,
      diferencaTotal,
    })

    const analise = {
      total_pdf: totalPdf,
      diferenca_total: diferencaTotal,
      no_pdf_nao_no_app,
      no_app_nao_no_pdf,
      valores_divergentes: [], // value-based matching: divergências são tratadas como ausentes
      resumo,
    }

    // -------------------------------------------------------------------------
    // 8. REGISTRAR USO
    // -------------------------------------------------------------------------
    try {
      await supabaseAdmin.from('ai_usage_log').insert({
        user_id: user.id,
        mes_referencia: mesAtual,
        feature_type: 'verificar_fatura',
      })
    } catch (trackErr) {
      console.error('Erro ao registrar uso (não bloqueia resposta):', trackErr)
    }

    // -------------------------------------------------------------------------
    // 9. RETORNAR RESPOSTA
    // -------------------------------------------------------------------------
    return jsonResponse({ analise })
  } catch (error) {
    console.error('Erro na verificar-fatura:', error)
    return jsonResponse({ error: error.message || 'Erro interno do servidor' }, 500)
  }
})
