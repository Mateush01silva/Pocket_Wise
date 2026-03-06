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

const MONTHLY_USAGE_LIMIT = 30
const OPENAI_MODEL = 'gpt-4o-mini'

// ============================================================================
// PERSONALITY PROMPTS
// ============================================================================

const PERSONALITY_PROMPTS: Record<string, string> = {
  conservador: `Você é um consultor financeiro cauteloso e conservador chamado PocketWise.
Avalie a compra com foco nos riscos financeiros. Seja direto, use SEMPRE os números reais dos envelopes.
REGRA FUNDAMENTAL: se o usuário tiver saldo disponível suficiente no envelope adequado, afirme claramente que pode comprar e mostre o saldo que sobrará. Se não tiver, explique com os números exatos qual o déficit.
Se a pergunta não mencionar o valor do item, peça o valor antes de responder qualquer coisa.
Responda em português brasileiro, em no máximo 5 linhas curtas.`,

  parceiro: `Você é o PocketWise, um parceiro financeiro honesto e direto, sem drama.
Avalie a compra de forma objetiva usando os números reais dos envelopes fornecidos.
REGRA FUNDAMENTAL: se o usuário tiver saldo disponível suficiente, afirme claramente que pode comprar — não invente restrições. Se não tiver, explique com os números exatos.
Se a pergunta não mencionar o valor do item, peça o valor antes de responder.
Responda em português brasileiro, em no máximo 5 linhas curtas.`,

  provocador: `Você é o PocketWise, um consultor financeiro provocador e irônico.
Desafie o usuário a pensar, mas SEMPRE com base nos números reais dos envelopes — nunca invente dados.
REGRA FUNDAMENTAL: se tiver saldo suficiente, confirme que pode comprar (pode provocar sobre se é uma boa ideia, mas não pode mentir dizendo que não tem orçamento). Se não tiver, seja implacável com os números reais do déficit.
Se a pergunta não mencionar o valor do item, peça o valor de forma provocadora antes de responder.
Responda em português brasileiro, em no máximo 5 linhas curtas.`,

  hype: `Você é o PocketWise, um torcedor financeiro animado que quer ver o usuário vencer!
Torça pelo usuário, seja enérgico e positivo — mas NUNCA omita ou distorça os números reais dos envelopes.
REGRA FUNDAMENTAL: se tiver saldo disponível suficiente, celebre e confirme que pode comprar com os números. Se não tiver, fale com entusiasmo sobre como guardar para comprar em breve, mostrando o déficit.
Se a pergunta não mencionar o valor do item, pergunte com energia antes de responder.
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

    // Cliente com token do usuário (para getUser)
    const supabaseUser = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser()
    if (authError || !user) {
      return jsonResponse({ error: 'Usuário não autenticado' }, 401)
    }

    // Cliente admin (service role) para operações internas
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // -------------------------------------------------------------------------
    // 2. VERIFICAR FEATURE FLAG — primeira coisa, antes de qualquer lógica
    // -------------------------------------------------------------------------
    let accessRecord = null

    // Tenta pelo user_id primeiro (mais rápido)
    const { data: accessByUid } = await supabaseAdmin
      .from('ai_feature_access')
      .select('id, user_id, email, enabled')
      .eq('user_id', user.id)
      .maybeSingle()

    if (accessByUid) {
      accessRecord = accessByUid
    } else {
      // Fallback: tenta pelo email (para seeds sem user_id preenchido)
      const userEmail = user.email ?? ''
      const { data: accessByEmail } = await supabaseAdmin
        .from('ai_feature_access')
        .select('id, user_id, email, enabled')
        .eq('email', userEmail)
        .maybeSingle()

      if (accessByEmail) {
        accessRecord = accessByEmail

        // Atualiza o user_id automaticamente para futuros lookups serem mais rápidos
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
        {
          error: 'Acesso à IA não disponível para este usuário',
          code: 'FEATURE_NOT_ENABLED',
        },
        403
      )
    }

    // -------------------------------------------------------------------------
    // 3. VERIFICAR LIMITE DE USO (30/mês)
    // -------------------------------------------------------------------------
    const mesAtual = getCurrentMes()

    const { count: usageCount } = await supabaseAdmin
      .from('ai_usage_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('mes_referencia', mesAtual)

    const usosUsados = usageCount ?? 0

    if (usosUsados >= MONTHLY_USAGE_LIMIT) {
      return jsonResponse(
        {
          error: `Você atingiu o limite de ${MONTHLY_USAGE_LIMIT} consultas este mês. O limite renova em 1° do próximo mês.`,
          code: 'MONTHLY_LIMIT_REACHED',
          usos_usados: usosUsados,
          limite: MONTHLY_USAGE_LIMIT,
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
    const mesRef = mesAtual // YYYY-MM

    // Buscar orçamento do mês (mes_referencia é DATE sempre no formato YYYY-MM-01)
    const { data: orcamento } = await supabaseAdmin
      .from('orcamentos_mensais')
      .select('id, mes_referencia')
      .eq('family_id', familyId)
      .eq('mes_referencia', `${mesRef}-01`)
      .maybeSingle()

    // Buscar categorias com seus budgets
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

      // Lançamentos do mês (pago + projetado)
      const mesStart = `${mesRef}-01`
      const mesEnd = `${mesRef}-31`

      const { data: lancamentos } = await supabaseAdmin
        .from('lancamentos')
        .select('categoria_id, valor, status, data, parcela_total, data_vencimento_fatura')
        .eq('family_id', familyId)
        .eq('tipo', 'despesa')
        .in('status', ['pago', 'projetado'])
        .gte('data', mesStart)
        .lte('data', mesEnd)

      if (budgets && categorias && lancamentos) {
        // Calcular gasto por categoria (replica a lógica de getMesEnvelope)
        const gastosPorCategoria: Record<string, number> = {}

        for (const l of lancamentos) {
          // Parcelas usam data_vencimento_fatura para determinar o mês do envelope
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

        // Montar envelopes para o contexto
        for (const budget of budgets) {
          const cat = categorias.find((c) => c.id === budget.categoria_id)
          if (!cat) continue

          const gasto = Math.round((gastosPorCategoria[budget.categoria_id] ?? 0) * 100) / 100
          const disponivel = Math.round((budget.valor_orcado - gasto) * 100) / 100
          const percentual = budget.valor_orcado > 0
            ? Math.round((gasto / budget.valor_orcado) * 10000) / 100
            : 0

          envelopes.push({
            nome: cat.nome,
            valor_orcado: budget.valor_orcado,
            valor_gasto: gasto,
            disponivel,
            percentual,
          })
        }

        // Ordenar por percentual usado (mais críticos primeiro)
        envelopes.sort((a, b) => b.percentual - a.percentual)
      }
    }

    // Calcular total disponível geral
    const totalOrcado = envelopes.reduce((s, e) => s + e.valor_orcado, 0)
    const totalGasto = envelopes.reduce((s, e) => s + e.valor_gasto, 0)
    const totalDisponivel = totalOrcado - totalGasto

    // Montar texto do contexto financeiro
    const contextoLinhas: string[] = [
      `Mês de referência: ${mesRef}`,
      `Orçamento total: ${formatBRL(totalOrcado)}`,
      `Total gasto até agora: ${formatBRL(totalGasto)} (${totalOrcado > 0 ? ((totalGasto / totalOrcado) * 100).toFixed(1) : 0}% do orçamento)`,
      `Total disponível no orçamento: ${formatBRL(totalDisponivel)}`,
      '',
      'Situação por envelope (categoria):',
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
      {
        role: 'system',
        content: systemPrompt,
      },
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
    // 8. REGISTRAR USO
    // -------------------------------------------------------------------------
    await supabaseAdmin.from('ai_usage_log').insert({
      user_id: user.id,
      mes_referencia: mesAtual,
    })

    // -------------------------------------------------------------------------
    // 9. RETORNAR RESPOSTA
    // -------------------------------------------------------------------------
    return jsonResponse({
      resposta,
      usos_usados: usosUsados + 1,
      usos_restantes: MONTHLY_USAGE_LIMIT - usosUsados - 1,
      limite: MONTHLY_USAGE_LIMIT,
      tone,
    })
  } catch (error) {
    console.error('Erro na posso-comprar-ia:', error)
    return jsonResponse({ error: error.message || 'Erro interno do servidor' }, 500)
  }
})
