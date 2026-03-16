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
  parcela?: string // ex: "2/6"
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

    // Limitar texto do PDF para não exceder tokens (max ~8000 chars)
    const pdfTextoLimitado = pdf_texto.length > 8000
      ? pdf_texto.substring(0, 8000) + '\n[... texto truncado por tamanho ...]'
      : pdf_texto

    // -------------------------------------------------------------------------
    // 5. MONTAR PROMPT
    // -------------------------------------------------------------------------
    const transacoesTexto = transacoes.length > 0
      ? transacoes.map((t) => {
          const parcela = t.parcela ? ` (parcela ${t.parcela})` : ''
          return `- ${t.data}: ${t.descricao}${parcela} | ${formatBRL(t.valor)}`
        }).join('\n')
      : '(nenhuma transação registrada no app para este período)'

    const systemPrompt = `Você é um auditor financeiro especializado em faturas de cartão de crédito brasileiro.
Sua tarefa é comparar as transações registradas em um app de finanças pessoais com o extrato real de uma fatura em PDF.
Seja preciso, objetivo e sempre responda em português brasileiro.
Retorne SOMENTE um JSON válido, sem markdown, sem explicações fora do JSON.`

    const userPrompt = `Compare as transações do app com o texto da fatura PDF e identifique todas as discrepâncias.

=== TRANSAÇÕES NO APP (${cartao_nome} - ${periodo}) ===
${transacoesTexto}
TOTAL NO APP: ${formatBRL(total_app)}

=== TEXTO EXTRAÍDO DA FATURA PDF ===
${pdfTextoLimitado}

Retorne um JSON com exatamente esta estrutura:
{
  "total_pdf": <número com o total encontrado no PDF, ou null se não encontrado>,
  "diferenca_total": <total_pdf - total_app, ou null>,
  "no_pdf_nao_no_app": [
    { "data": "<data>", "descricao": "<descrição>", "valor": <número> }
  ],
  "no_app_nao_no_pdf": [
    { "data": "<data>", "descricao": "<descrição>", "valor": <número> }
  ],
  "valores_divergentes": [
    { "descricao": "<descrição>", "valor_app": <número>, "valor_pdf": <número>, "diferenca": <número> }
  ],
  "resumo": "<explicação em português do que foi encontrado, por que os valores podem estar diferentes e o que o usuário deve checar>"
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
        max_tokens: 1500,
        temperature: 0.1,
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

    let analise
    try {
      analise = JSON.parse(content)
    } catch {
      console.error('Falha ao parsear JSON da IA:', content)
      return jsonResponse({ error: 'Resposta da IA em formato inválido. Tente novamente.' }, 502)
    }

    // -------------------------------------------------------------------------
    // 7. REGISTRAR USO
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
    // 8. RETORNAR RESPOSTA
    // -------------------------------------------------------------------------
    return jsonResponse({ analise })
  } catch (error) {
    console.error('Erro na verificar-fatura:', error)
    return jsonResponse({ error: error.message || 'Erro interno do servidor' }, 500)
  }
})
