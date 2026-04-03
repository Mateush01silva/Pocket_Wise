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

const TOTAL_LIMIT = 30        // pool total mensal
const OPENAI_MODEL = 'gpt-4o-mini'

// ============================================================================
// PERSONALITY PROMPTS
// ============================================================================

// Regra de envelopes compartilhada por todos os tons
const ENVELOPE_RULE = `
LÓGICA DE ENVELOPES (siga sempre):
1. Identifique em qual envelope a compra se encaixa (ex: tênis → Vestuário; pizza → Alimentação; show → Lazer).
2. Verifique o saldo disponível DESSE envelope específico.
3. Se o saldo do envelope for suficiente: diga que pode comprar, mostrando quanto sobrará naquele envelope.
4. Se o saldo do envelope for insuficiente: diga que não pode, mostrando o déficit exato naquele envelope.
5. NUNCA use o total geral do orçamento para aprovar a compra — o que importa é o envelope certo.
6. Se nenhum envelope se encaixar bem, mencione o mais próximo e explique.
7. Se a pergunta não mencionar o valor do item, peça o valor antes de qualquer análise.`

const PERSONALITY_PROMPTS: Record<string, string> = {
  conservador: `Você é um consultor financeiro cauteloso e conservador chamado PocketWise.
Avalie a compra com foco nos riscos financeiros, usando os números reais dos envelopes.
${ENVELOPE_RULE}
Responda em português brasileiro, em no máximo 5 linhas curtas.`,

  parceiro: `Você é o PocketWise, um parceiro financeiro honesto e direto, sem drama.
Avalie a compra de forma objetiva com os dados reais — sem inventar restrições e sem ignorar limites.
${ENVELOPE_RULE}
Responda em português brasileiro, em no máximo 5 linhas curtas.`,

  provocador: `Você é o PocketWise, um consultor financeiro provocador e irônico.
Desafie o usuário a pensar, mas SEMPRE com base nos números reais — nunca invente dados.
${ENVELOPE_RULE}
Pode provocar sobre a decisão, mas nunca minta sobre os números. Se der, diz que dá. Se não der, seja implacável com o déficit.
Responda em português brasileiro, em no máximo 5 linhas curtas.`,

  hype: `Você é o PocketWise, um torcedor financeiro animado que quer ver o usuário vencer!
Seja enérgico e positivo — mas NUNCA distorça os números reais dos envelopes.
${ENVELOPE_RULE}
Se der pra comprar, celebre com os números. Se não der, torça para o usuário guardar e mostrar quando vai conseguir.
Responda em português brasileiro, em no máximo 5 linhas curtas.`,
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getCurrentMes(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function getRenovacaoDate(mesAtual: string): string {
  const [ano, mes] = mesAtual.split('-').map(Number)
  // new Date usa mês 0-indexed: mes (1-based) já aponta pro mês seguinte
  const dataRenovacao = new Date(ano, mes, 1)
  return dataRenovacao.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

function getLastDayOfMonth(mesRef: string): string {
  const [ano, mes] = mesRef.split('-').map(Number)
  const lastDay = new Date(ano, mes, 0).getDate() // dia 0 do mês seguinte = último dia do mês atual
  return `${mesRef}-${String(lastDay).padStart(2, '0')}`
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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
    // 3. VERIFICAR CRÉDITOS DISPONÍVEIS (pool compartilhado)
    // -------------------------------------------------------------------------
    const mesAtual = getCurrentMes()

    // Lê configuração de alocação do usuário (default: 10 proativas / 20 manuais)
    const { data: creditsConfig } = await supabaseAdmin
      .from('ai_credits_config')
      .select('creditos_proativas')
      .eq('user_id', user.id)
      .maybeSingle()

    const creditosProativas = creditsConfig?.creditos_proativas ?? 10
    const limiteManual = TOTAL_LIMIT - creditosProativas

    // Conta todos os usos manuais do mês (posso_comprar + assistente + legados NULL)
    // Fetch completo: max 30 rows por mês/usuário — filtra em memória para lidar com NULLs
    const { data: usageRows, error: usageErr } = await supabaseAdmin
      .from('ai_usage_log')
      .select('feature_type')
      .eq('user_id', user.id)
      .eq('mes_referencia', mesAtual)

    // Fail-open intencional: se a leitura do log falhar, permite a consulta
    // e loga para monitoramento — bloquear por falha de infra é pior que permitir.
    if (usageErr) {
      console.warn(`[posso-comprar-ia] falha ao ler usage_log (fail-open): ${usageErr.message}`)
    }

    const usadoManual = (usageRows ?? []).filter((r) => r.feature_type !== 'proativa').length

    if (usadoManual >= limiteManual) {
      return jsonResponse(
        {
          error: `Você atingiu o limite de ${limiteManual} consultas manuais este mês. Seus créditos renovam em ${getRenovacaoDate(mesAtual)}.`,
          code: 'MONTHLY_LIMIT_REACHED',
          usos_usados: usadoManual,
          usos_restantes: 0,
          limite: limiteManual,
        },
        429
      )
    }

    // -------------------------------------------------------------------------
    // 4. LER PERGUNTA E family_id DO BODY
    // -------------------------------------------------------------------------
    const { pergunta, family_id: familyId } = await req.json()

    if (!pergunta || typeof pergunta !== 'string' || pergunta.trim().length < 3) {
      return jsonResponse({ error: 'Pergunta inválida ou muito curta' }, 400)
    }

    if (!familyId) {
      return jsonResponse({ error: 'family_id não fornecido' }, 400)
    }

    // -------------------------------------------------------------------------
    // 5. BUSCAR TOM DE PERSONALIDADE
    // -------------------------------------------------------------------------
    const { data: prefData } = await supabaseAdmin
      .from('user_ai_preferences')
      .select('personality_tone')
      .eq('user_id', user.id)
      .maybeSingle()

    const tone = prefData?.personality_tone ?? 'parceiro'
    const systemPrompt = PERSONALITY_PROMPTS[tone] ?? PERSONALITY_PROMPTS['parceiro']

    // -------------------------------------------------------------------------
    // 6. MONTAR CONTEXTO FINANCEIRO
    // -------------------------------------------------------------------------
    const mesRef = mesAtual

    const { data: orcamento } = await supabaseAdmin
      .from('orcamentos_mensais')
      .select('id, mes_referencia')
      .eq('family_id', familyId)
      .eq('mes_referencia', `${mesRef}-01`)
      .maybeSingle()

    let envelopes: Array<{
      nome: string
      valor_orcado: number
      valor_gasto: number
      disponivel: number
      percentual: number
    }> = []

    if (orcamento) {
      const { data: budgets } = await supabaseAdmin
        .from('categorias_budget')
        .select('categoria_id, valor_orcado, prioridade')
        .eq('orcamento_id', orcamento.id)

      const { data: categorias } = await supabaseAdmin
        .from('categorias')
        .select('id, nome, tipo')
        .eq('family_id', familyId)
        .eq('tipo', 'despesa')

      const mesStart = `${mesRef}-01`
      const mesEnd = getLastDayOfMonth(mesRef)

      const { data: lancamentos } = await supabaseAdmin
        .from('lancamentos')
        .select('categoria_id, valor, status, data, parcela_total, data_vencimento_fatura')
        .eq('family_id', familyId)
        .eq('tipo', 'despesa')
        .in('status', ['pago', 'projetado'])
        .gte('data', mesStart)
        .lte('data', mesEnd)

      if (budgets && categorias && lancamentos) {
        const gastosPorCategoria: Record<string, number> = {}

        for (const l of lancamentos) {
          let mesEnvelope: string
          if (l.parcela_total && l.parcela_total > 1 && l.data_vencimento_fatura) {
            mesEnvelope = l.data_vencimento_fatura.substring(0, 7)
          } else {
            mesEnvelope = l.data.substring(0, 7)
          }
          if (mesEnvelope === mesRef) {
            gastosPorCategoria[l.categoria_id] = (gastosPorCategoria[l.categoria_id] ?? 0) + l.valor
          }
        }

        for (const budget of budgets) {
          const cat = categorias.find((c) => c.id === budget.categoria_id)
          if (!cat) continue

          const gasto = Math.round((gastosPorCategoria[budget.categoria_id] ?? 0) * 100) / 100
          const disponivel = Math.round((budget.valor_orcado - gasto) * 100) / 100
          const percentual = budget.valor_orcado > 0
            ? Math.round((gasto / budget.valor_orcado) * 10000) / 100
            : 0

          envelopes.push({ nome: cat.nome, valor_orcado: budget.valor_orcado, valor_gasto: gasto, disponivel, percentual })
        }

        envelopes.sort((a, b) => b.percentual - a.percentual)
      }
    }

    const totalOrcado = envelopes.reduce((s, e) => s + e.valor_orcado, 0)
    const totalGasto = envelopes.reduce((s, e) => s + e.valor_gasto, 0)
    const totalDisponivel = totalOrcado - totalGasto

    const contextoLinhas: string[] = [
      `Mês de referência: ${mesRef}`,
      `[Totais apenas para referência geral — a decisão de compra deve ser baseada no envelope específico]`,
      `Orçamento total (soma de todos os envelopes): ${formatBRL(totalOrcado)}`,
      `Total gasto (soma de todos os envelopes): ${formatBRL(totalGasto)}`,
      '',
      'Situação detalhada por envelope — USE ESTES DADOS para avaliar a compra:',
    ]

    for (const env of envelopes) {
      const status = env.percentual > 100 ? '🔴' : env.percentual >= 80 ? '🟡' : '🟢'
      contextoLinhas.push(
        `  ${status} ${env.nome}: orçado ${formatBRL(env.valor_orcado)}, gasto ${formatBRL(env.valor_gasto)} (${env.percentual}%), disponível ${formatBRL(env.disponivel)}`
      )
    }

    if (envelopes.length === 0) {
      contextoLinhas.push('  (Nenhum orçamento/envelope configurado para este mês — informe ao usuário que não há orçamento cadastrado e que não é possível avaliar sem dados financeiros)')
    }

    const contextoFinanceiro = contextoLinhas.join('\n')

    // -------------------------------------------------------------------------
    // 7. CHAMAR A API DA OPENAI
    // -------------------------------------------------------------------------
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('OPENAI_API_KEY não configurada')
      return jsonResponse({ error: 'Configuração de IA incompleta no servidor' }, 500)
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Aqui está minha situação financeira atual:\n\n${contextoFinanceiro}\n\nMinha pergunta: ${pergunta.trim()}`,
      },
    ]

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        max_tokens: 300,
        temperature: 0.7,
      }),
    })

    if (!openaiRes.ok) {
      const errText = await openaiRes.text()
      console.error('OpenAI error:', errText)
      return jsonResponse({ error: 'Erro ao consultar a IA. Tente novamente.' }, 502)
    }

    const openaiData = await openaiRes.json()
    const resposta = openaiData.choices?.[0]?.message?.content ?? ''

    if (!resposta) {
      return jsonResponse({ error: 'A IA não retornou uma resposta válida.' }, 502)
    }

    // -------------------------------------------------------------------------
    // 8. REGISTRAR USO — em try-catch isolado: falha não bloqueia a resposta
    // -------------------------------------------------------------------------
    try {
      await supabaseAdmin.from('ai_usage_log').insert({
        user_id: user.id,
        mes_referencia: mesAtual,
        feature_type: 'posso_comprar',
      })
    } catch (trackErr) {
      console.error('Erro ao registrar uso (não bloqueia resposta):', trackErr)
    }

    // -------------------------------------------------------------------------
    // 9. RETORNAR RESPOSTA
    // -------------------------------------------------------------------------
    return jsonResponse({
      resposta,
      usos_usados: usadoManual + 1,
      usos_restantes: limiteManual - usadoManual - 1,
      limite: limiteManual,
      tone,
    })
  } catch (error) {
    console.error('Erro na posso-comprar-ia:', error)
    return jsonResponse({ error: error.message || 'Erro interno do servidor' }, 500)
  }
})
