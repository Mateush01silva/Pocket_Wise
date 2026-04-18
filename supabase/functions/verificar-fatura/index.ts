import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

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

interface FaturaTransacao {
  data: string
  descricao: string
  valor: number
}

interface ExtracaoIA {
  total_fatura: number | null
  transacoes: FaturaTransacao[]
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
// Date parsing — handles "10/03", "10/03/2026", "2026-03-10"
// ---------------------------------------------------------------------------
function parseInvoiceDate(dateStr: string, defaultYear: number): Date | null {
  const s = dateStr.trim()
  const m1 = s.match(/^(\d{1,2})\/(\d{1,2})$/)
  if (m1) return new Date(defaultYear, parseInt(m1[2]) - 1, parseInt(m1[1]))
  const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m2) return new Date(parseInt(m2[3]), parseInt(m2[2]) - 1, parseInt(m2[1]))
  const m3 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m3) return new Date(parseInt(m3[1]), parseInt(m3[2]) - 1, parseInt(m3[3]))
  return null
}

// ---------------------------------------------------------------------------
// Matching algorithm — 3 passes, ALL require date proximity.
//
// The old "value-only, no date" pass was causing false matches (wrong items
// matched together), making the discrepancy count worse instead of better.
//
// Pass 1: value ≤ R$0.02  AND  date ≤ 1 day  →  exact match
// Pass 2: value ≤ R$0.02  AND  date ≤ 5 days →  posting-delay match
// Pass 3: value within 2% AND  date ≤ 3 days →  FX/IOF rounding match
// ---------------------------------------------------------------------------
function matchTransacoes(
  appItems: TransacaoSimples[],
  extItems: FaturaTransacao[],
  anoFatura: number,
): {
  no_ext_nao_no_app: FaturaTransacao[]
  no_app_nao_no_ext: TransacaoSimples[]
} {
  const appPool = appItems.map((item) => ({ item, matched: false }))
  const extPool = extItems.map((item) => ({ item, matched: false }))

  const MS_1_DAY = 24 * 60 * 60 * 1000
  const MS_3_DAYS = 3 * MS_1_DAY
  const MS_5_DAYS = 5 * MS_1_DAY

  function tryMatch(
    valueTolerance: (a: number, b: number) => boolean,
    dateTolerance: number,
  ) {
    for (const extEntry of extPool) {
      if (extEntry.matched) continue
      const extDate = parseInvoiceDate(extEntry.item.data, anoFatura)
      if (!extDate) continue

      const idx = appPool.findIndex((a) => {
        if (a.matched) return false
        if (!valueTolerance(a.item.valor, extEntry.item.valor)) return false
        const appDate = new Date(a.item.data)
        return Math.abs(appDate.getTime() - extDate.getTime()) <= dateTolerance
      })

      if (idx !== -1) {
        appPool[idx].matched = true
        extEntry.matched = true
      }
    }
  }

  // Pass 1: exact value + same day (±1 day)
  tryMatch((a, b) => Math.abs(a - b) <= 0.02, MS_1_DAY)

  // Pass 2: exact value + posting delay (≤5 days)
  tryMatch((a, b) => Math.abs(a - b) <= 0.02, MS_5_DAYS)

  // Pass 3: near value (≤2%) + close date (≤3 days) — handles FX rounding
  tryMatch((a, b) => {
    const max = Math.max(a, b)
    return max > 0 && Math.abs(a - b) / max <= 0.02
  }, MS_3_DAYS)

  return {
    no_ext_nao_no_app: extPool.filter((e) => !e.matched).map((e) => e.item),
    no_app_nao_no_ext: appPool.filter((e) => !e.matched).map((e) => e.item),
  }
}

function gerarResumo(params: {
  noPdfNaoNoApp: FaturaTransacao[]
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
// PROMPT
// ============================================================================

function buildExcelPrompt(excelTexto: string): { system: string; user: string } {
  const system = `Você é um processador especializado em faturas de cartão de crédito brasileiras exportadas em planilha. Você recebe o conteúdo da planilha em formato de texto tabulado (colunas separadas por tab). Retorne SOMENTE JSON válido, sem markdown, sem texto adicional.`

  const user = `Analise esta planilha de fatura de cartão de crédito e extraia os lançamentos de COMPRAS/DÉBITOS.

REGRA PRINCIPAL DE IDENTIFICAÇÃO:
Uma linha é uma transação SOMENTE se ela contiver OBRIGATORIAMENTE os três elementos na mesma linha:
  1. Uma DATA (ex: "10/03", "10/03/2026", "2026-03-10")
  2. Uma DESCRIÇÃO de estabelecimento ou serviço (texto)
  3. Um VALOR numérico positivo

Linhas que não tenham os três elementos simultaneamente são cabeçalhos, totais, subtotais ou linhas de separação — IGNORE-AS.

REGRAS ADICIONAIS:
1. Extraia SOMENTE transações de DÉBITO. Inclua:
   - Compras à vista e parceladas (inclua cada parcela como transação separada)
   - Tarifas, IOF, anuidade, encargos
2. Ignore pagamentos de fatura e créditos/estornos que reduzem a fatura.
3. Para estornos: se a compra original E o estorno aparecem, exclua os dois. Se apenas o estorno aparece, ignore-o.
4. "valor" deve ser número positivo (converta "R$ 77,08" → 77.08 e "1.234,56" → 1234.56).
5. "data" deve ser exatamente como aparece na planilha (ex: "10/03" ou "10/03/2026").
6. Capture o total/valor a pagar da fatura se houver linha específica para isso.

=== PLANILHA (texto tabulado, colunas separadas por tab) ===
${excelTexto}

Retorne JSON com esta estrutura EXATA:
{
  "total_fatura": <número com o total a pagar da fatura, ou null se não encontrado>,
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
    // 4. LER BODY — aceita somente Excel (base64)
    // -------------------------------------------------------------------------
    const body = await req.json()
    const { excel_base64, excel_senha, transacoes, total_app, cartao_nome, periodo } = body as {
      excel_base64: string
      excel_senha?: string
      transacoes: TransacaoSimples[]
      total_app: number
      cartao_nome: string
      periodo: string
    }

    if (!excel_base64) {
      return jsonResponse({ error: 'Arquivo Excel não enviado (excel_base64 obrigatório)' }, 400)
    }

    if (!transacoes || !Array.isArray(transacoes)) {
      return jsonResponse({ error: 'Lista de transações inválida' }, 400)
    }

    // -------------------------------------------------------------------------
    // 5. PARSEAR EXCEL COM SheetJS
    // -------------------------------------------------------------------------
    let textoLimitado = ''
    try {
      const workbook = XLSX.read(excel_base64, {
        type: 'base64',
        password: excel_senha || undefined,
        raw: false,
        cellDates: false,
      })

      // Pick the sheet with most rows
      let sheetName = workbook.SheetNames[0]
      let maxRows = 0
      for (const name of workbook.SheetNames) {
        const sheet = workbook.Sheets[name]
        if (!sheet['!ref']) continue
        const range = XLSX.utils.decode_range(sheet['!ref'])
        const rows = range.e.r - range.s.r
        if (rows > maxRows) { maxRows = rows; sheetName = name }
      }

      const sheet = workbook.Sheets[sheetName]
      const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', blankrows: false })
      textoLimitado = csv.length > 24000 ? csv.substring(0, 24000) + '\n[... truncado ...]' : csv
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : ''
      if (msg.includes('password') || msg.includes('encrypted') || msg.includes('cfb')) {
        return jsonResponse({
          error: 'Arquivo protegido por senha não pôde ser aberto.',
          code: 'EXCEL_PASSWORD_PROTECTED',
        }, 400)
      }
      console.error('Erro ao parsear Excel:', err)
      return jsonResponse({ error: 'Não foi possível abrir o arquivo Excel. Verifique se é um .xlsx ou .xls válido.' }, 400)
    }

    // -------------------------------------------------------------------------
    // 6. CHAMAR OPENAI
    // -------------------------------------------------------------------------
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      return jsonResponse({ error: 'Configuração de IA incompleta no servidor' }, 500)
    }

    const { system: systemPrompt, user: userPrompt } = buildExcelPrompt(textoLimitado)

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
      // Accept both key names for backward compat with cached responses
      if ((extracao as any).total_pdf !== undefined && extracao.total_fatura === undefined) {
        extracao.total_fatura = (extracao as any).total_pdf
      }
    } catch {
      const finishReason = openaiData.choices?.[0]?.finish_reason
      console.error('Falha ao parsear extração (finish_reason:', finishReason, '):', content.slice(0, 300))
      if (finishReason === 'length') {
        return jsonResponse({ error: 'O arquivo é muito extenso para processar. Tente um período menor.' }, 502)
      }
      return jsonResponse({ error: 'Falha ao extrair transações. Tente novamente.' }, 502)
    }

    // -------------------------------------------------------------------------
    // 7. MATCHING POR VALOR + DATA (3 passes, todos requerem data próxima)
    // -------------------------------------------------------------------------
    const anoFaturaMatch = periodo.match(/\b(20\d{2})\b/)
    const anoFatura = anoFaturaMatch ? parseInt(anoFaturaMatch[1]) : new Date().getFullYear()

    const { no_ext_nao_no_app, no_app_nao_no_ext } = matchTransacoes(transacoes, extracao.transacoes, anoFatura)

    const totalPdf = extracao.total_fatura ?? null
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
