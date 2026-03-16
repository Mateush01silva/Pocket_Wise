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

interface ExtracaoIA {
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
  return new Date(ano, mes, 1).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

// ---------------------------------------------------------------------------
// Value-based matching (deterministic, no AI name confusion)
// ---------------------------------------------------------------------------
function matchTransacoes(
  appItems: TransacaoSimples[],
  extItems: PDFTransacao[],
): {
  no_ext_nao_no_app: PDFTransacao[]
  no_app_nao_no_ext: TransacaoSimples[]
} {
  const appPool = appItems.map((item) => ({ item, matched: false }))
  const extPool = extItems.map((item) => ({ item, matched: false }))

  for (const extEntry of extPool) {
    const idx = appPool.findIndex(
      (a) => !a.matched && Math.abs(a.item.valor - extEntry.item.valor) < 0.10,
    )
    if (idx !== -1) {
      appPool[idx].matched = true
      extEntry.matched = true
    }
  }

  return {
    no_ext_nao_no_app: extPool.filter((e) => !e.matched).map((e) => e.item),
    no_app_nao_no_ext: appPool.filter((e) => !e.matched).map((e) => e.item),
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
        `O total da fatura (${formatBRL(totalPdf!)}) é ${formatBRL(diferencaTotal)} maior que o registrado no app (${formatBRL(totalApp)}).`,
      )
    } else {
      partes.push(
        `O total da fatura (${formatBRL(totalPdf!)}) é ${formatBRL(Math.abs(diferencaTotal))} menor que o registrado no app (${formatBRL(totalApp)}).`,
      )
    }
  }

  if (noPdfNaoNoApp.length === 0 && noAppNaoNoPdf.length === 0) {
    partes.push('Todos os lançamentos conferem perfeitamente.')
  } else {
    if (noPdfNaoNoApp.length > 0) {
      partes.push(`${noPdfNaoNoApp.length} lançamento(s) da fatura não ${noPdfNaoNoApp.length === 1 ? 'está registrado' : 'estão registrados'} no app.`)
    }
    if (noAppNaoNoPdf.length > 0) {
      partes.push(`${noAppNaoNoPdf.length} lançamento(s) do app não ${noAppNaoNoPdf.length === 1 ? 'foi encontrado' : 'foram encontrados'} na fatura.`)
    }
  }

  return partes.join(' ')
}

// ============================================================================
// PROMPTS
// ============================================================================

function buildPdfPrompt(pdfTexto: string): { system: string; user: string } {
  const system = `Você é um parser de documentos financeiros brasileiros. Extraia todas as transações desta fatura de cartão de crédito a partir de texto extraído por OCR. Retorne SOMENTE JSON válido, sem markdown, sem texto adicional.`

  const user = `Extraia TODAS as transações individuais desta fatura de cartão de crédito.

REGRAS:
1. Cada linha de lançamento é uma transação SEPARADA — nunca agrupe por estabelecimento.
2. Para parcelas (ex: "Loja X 2/6"), cada parcela é uma transação separada.
3. "valor" deve ser número positivo (sem sinal negativo).
4. Inclua compras, tarifas, encargos, IOF, anuidades — tudo que gera débito.
5. Ignore linhas de pagamento/crédito (valores que reduzem a fatura).

=== TEXTO DA FATURA PDF (extraído por OCR) ===
${pdfTexto}

Retorne JSON com esta estrutura EXATA:
{
  "total_pdf": <número com o total/valor a pagar da fatura, ou null se não encontrado>,
  "transacoes": [
    {"data": "<data como aparece>", "descricao": "<nome do estabelecimento>", "valor": <número positivo>}
  ]
}`

  return { system, user }
}

function buildExcelPrompt(excelTexto: string): { system: string; user: string } {
  const system = `Você é um processador especializado em faturas de cartão de crédito brasileiras exportadas em planilha. Você recebe o conteúdo da planilha em formato de texto tabulado (colunas separadas por tab). Retorne SOMENTE JSON válido, sem markdown, sem texto adicional.`

  const user = `Analise esta planilha de fatura de cartão de crédito e extraia os lançamentos de COMPRAS/DÉBITOS.

REGRAS DE EXTRAÇÃO:
1. A planilha pode ter cabeçalhos, informações do titular e linhas em branco antes dos dados — identifique onde começam os lançamentos.
2. Extraia SOMENTE transações de DÉBITO (compras, tarifas, juros, IOF, anuidade). Ignore pagamentos e créditos.
3. Para estornos (estorno/cancelamento de uma compra): se o estorno e a compra original AMBOS aparecem na planilha, exclua os dois do resultado final (cancelam-se mutuamente). Se apenas o estorno aparece sem a compra original, ignore-o também.
4. Cada linha de compra é uma transação SEPARADA — não agrupe por estabelecimento.
5. "valor" deve ser número positivo.
6. Identifique e retorne o total da fatura se houver linha de total/subtotal.

=== PLANILHA (texto tabulado, colunas separadas por tab) ===
${excelTexto}

Retorne JSON com esta estrutura EXATA:
{
  "total_pdf": <número com o total a pagar da fatura, ou null se não encontrado>,
  "transacoes": [
    {"data": "<data como aparece>", "descricao": "<estabelecimento ou descrição>", "valor": <número positivo>}
  ]
}`

  return { system, user }
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
    // 4. LER BODY — aceita PDF ou Excel
    // -------------------------------------------------------------------------
    const body = await req.json()
    const { pdf_texto, excel_texto, transacoes, total_app, cartao_nome, periodo } = body as {
      pdf_texto?: string
      excel_texto?: string
      transacoes: TransacaoSimples[]
      total_app: number
      cartao_nome: string
      periodo: string
    }

    const isExcel = Boolean(excel_texto && !pdf_texto)
    const textoFonte = excel_texto ?? pdf_texto ?? ''

    if (!textoFonte || textoFonte.trim().length < 20) {
      return jsonResponse({ error: 'Conteúdo do arquivo inválido ou muito curto' }, 400)
    }

    if (!transacoes || !Array.isArray(transacoes)) {
      return jsonResponse({ error: 'Lista de transações inválida' }, 400)
    }

    // Limitar tamanho (~8k tokens para PDF, Excel já vem limitado do client)
    const textoLimitado = textoFonte.length > 32000
      ? textoFonte.substring(0, 32000) + '\n[... truncado ...]'
      : textoFonte

    // -------------------------------------------------------------------------
    // 5. PROMPT — diferente para Excel vs PDF
    // -------------------------------------------------------------------------
    const { system: systemPrompt, user: userPrompt } = isExcel
      ? buildExcelPrompt(textoLimitado)
      : buildPdfPrompt(textoLimitado)

    // -------------------------------------------------------------------------
    // 6. CHAMAR OPENAI
    // -------------------------------------------------------------------------
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
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

    let extracao: ExtracaoIA
    try {
      const jsonStart = content.indexOf('{')
      const jsonEnd = content.lastIndexOf('}')
      if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) throw new Error('no JSON')
      extracao = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as ExtracaoIA
      if (!Array.isArray(extracao.transacoes)) extracao.transacoes = []
    } catch {
      const finishReason = openaiData.choices?.[0]?.finish_reason
      console.error('Falha ao parsear extração (finish_reason:', finishReason, '):', content.slice(0, 300))
      if (finishReason === 'length') {
        return jsonResponse({ error: 'O arquivo é muito extenso para processar. Tente um período menor.' }, 502)
      }
      return jsonResponse({ error: 'Falha ao extrair transações. Tente novamente.' }, 502)
    }

    // -------------------------------------------------------------------------
    // 7. MATCHING POR VALOR (TypeScript, determinístico)
    // -------------------------------------------------------------------------
    const { no_ext_nao_no_app, no_app_nao_no_ext } = matchTransacoes(transacoes, extracao.transacoes)

    const totalPdf = extracao.total_pdf ?? null
    const diferencaTotal = totalPdf !== null ? totalPdf - total_app : null

    const resumo = gerarResumo({
      noPdfNaoNoApp: no_ext_nao_no_app,
      noAppNaoNoPdf: no_app_nao_no_ext,
      totalPdf,
      totalApp: total_app,
      diferencaTotal,
    })

    const analise = {
      total_pdf: totalPdf,
      diferenca_total: diferencaTotal,
      no_pdf_nao_no_app: no_ext_nao_no_app,
      no_app_nao_no_pdf: no_app_nao_no_ext,
      valores_divergentes: [],
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
      console.error('Erro ao registrar uso:', trackErr)
    }

    // -------------------------------------------------------------------------
    // 9. RETORNAR
    // -------------------------------------------------------------------------
    return jsonResponse({ analise })
  } catch (error) {
    console.error('Erro na verificar-fatura:', error)
    return jsonResponse({ error: error.message || 'Erro interno do servidor' }, 500)
  }
})
