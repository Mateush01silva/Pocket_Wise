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

const TOTAL_LIMIT = 30        // pool total mensal (compartilhado entre features)
const OPENAI_MODEL = 'gpt-4o-mini'
const HISTORY_WINDOW = 10     // últimas N mensagens usadas como contexto

// ============================================================================
// PERSONALITY PROMPTS
// ============================================================================

const PERSONALITY_PROMPTS: Record<string, string> = {
  conservador: `Você é o PocketWise Assistente, um consultor financeiro pessoal cauteloso e conservador.
Responda perguntas financeiras com foco em riscos, reservas e segurança financeira.
Use SEMPRE os dados reais fornecidos no contexto. Nunca invente números.
Seja direto e recomende cautela quando necessário.
Responda em português brasileiro.`,

  parceiro: `Você é o PocketWise Assistente, um parceiro financeiro pessoal honesto e direto.
Responda perguntas financeiras de forma objetiva e clara, usando os dados reais do contexto.
Não invente dados — se não tiver informação suficiente, diga claramente.
Responda em português brasileiro.`,

  provocador: `Você é o PocketWise Assistente, um consultor financeiro pessoal irônico e provocador.
Responda com provocações saudáveis, desafiando o usuário a pensar — mas SEMPRE com base nos dados reais.
Nunca invente números ou restrições que não existem nos dados.
Responda em português brasileiro.`,

  hype: `Você é o PocketWise Assistente, um parceiro financeiro animado e enérgico!
Responda com entusiasmo — mas NUNCA omita ou distorça os dados reais.
Se a situação for boa, celebre. Se for ruim, seja honesto com energia construtiva.
Responda em português brasileiro.`,
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
  const dataRenovacao = new Date(ano, mes, 1)
  return dataRenovacao.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
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
    // 2. VERIFICAR FEATURE FLAG (master) + PERMISSÃO ESPECÍFICA ('assistente')
    // -------------------------------------------------------------------------
    let accessId: string | null = null

    const { data: accessByUid } = await supabaseAdmin
      .from('ai_feature_access')
      .select('id, enabled')
      .eq('user_id', user.id)
      .maybeSingle()

    if (accessByUid) {
      if (!accessByUid.enabled) {
        return jsonResponse({ error: 'Acesso à IA não disponível para este usuário', code: 'FEATURE_NOT_ENABLED' }, 403)
      }
      accessId = accessByUid.id
    } else {
      const { data: accessByEmail } = await supabaseAdmin
        .from('ai_feature_access')
        .select('id, enabled, user_id')
        .eq('email', user.email ?? '')
        .maybeSingle()

      if (!accessByEmail || !accessByEmail.enabled) {
        return jsonResponse({ error: 'Acesso à IA não disponível para este usuário', code: 'FEATURE_NOT_ENABLED' }, 403)
      }
      accessId = accessByEmail.id

      if (!accessByEmail.user_id) {
        await supabaseAdmin
          .from('ai_feature_access')
          .update({ user_id: user.id, updated_at: new Date().toISOString() })
          .eq('id', accessId)
      }
    }

    const { data: permission } = await supabaseAdmin
      .from('ai_feature_permissions')
      .select('enabled')
      .eq('access_id', accessId)
      .eq('feature_key', 'assistente')
      .maybeSingle()

    if (!permission || !permission.enabled) {
      return jsonResponse({ error: 'Funcionalidade Assistente não habilitada', code: 'FEATURE_NOT_ENABLED' }, 403)
    }

    // -------------------------------------------------------------------------
    // 3. VERIFICAR CRÉDITOS DISPONÍVEIS (pool compartilhado)
    // -------------------------------------------------------------------------
    const mesAtual = getCurrentMes()

    const { data: creditsConfig } = await supabaseAdmin
      .from('ai_credits_config')
      .select('creditos_proativas')
      .eq('user_id', user.id)
      .maybeSingle()

    const creditosProativas = creditsConfig?.creditos_proativas ?? 10
    const limiteManual = TOTAL_LIMIT - creditosProativas

    // Conta usos manuais do mês (posso_comprar + assistente + legados NULL)
    const { data: usageRows } = await supabaseAdmin
      .from('ai_usage_log')
      .select('feature_type')
      .eq('user_id', user.id)
      .eq('mes_referencia', mesAtual)

    const usadoManual = (usageRows ?? []).filter((r) => r.feature_type !== 'proativa').length

    if (usadoManual >= limiteManual) {
      return jsonResponse(
        {
          error: `Você atingiu o limite de ${limiteManual} consultas manuais este mês. Seus créditos renovam em ${getRenovacaoDate(mesAtual)}.`,
          code: 'MONTHLY_LIMIT_REACHED',
          creditos_restantes: 0,
          limite_manual: limiteManual,
        },
        429
      )
    }

    // -------------------------------------------------------------------------
    // 4. LER BODY
    // -------------------------------------------------------------------------
    const { mensagem, family_id: familyId } = await req.json()

    if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length < 2) {
      return jsonResponse({ error: 'Mensagem inválida ou muito curta' }, 400)
    }

    if (!familyId) {
      return jsonResponse({ error: 'family_id não fornecido' }, 400)
    }

    // -------------------------------------------------------------------------
    // 5. TOM DE PERSONALIDADE
    // -------------------------------------------------------------------------
    const { data: prefData } = await supabaseAdmin
      .from('user_ai_preferences')
      .select('personality_tone')
      .eq('user_id', user.id)
      .maybeSingle()

    const tone = prefData?.personality_tone ?? 'parceiro'
    const systemBasePrompt = PERSONALITY_PROMPTS[tone] ?? PERSONALITY_PROMPTS['parceiro']

    // -------------------------------------------------------------------------
    // 6. MONTAR CONTEXTO FINANCEIRO
    // -------------------------------------------------------------------------
    const mesRef = mesAtual
    const mesAnterior = (() => {
      const [ano, mes] = mesRef.split('-').map(Number)
      const d = new Date(ano, mes - 2, 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    })()

    const { data: orcamento } = await supabaseAdmin
      .from('orcamentos_mensais')
      .select('id')
      .eq('family_id', familyId)
      .eq('mes_referencia', `${mesRef}-01`)
      .maybeSingle()

    type Envelope = { nome: string; valor_orcado: number; valor_gasto: number; disponivel: number; percentual: number }
    let envelopes: Envelope[] = []
    let totalReceitas = 0

    if (orcamento) {
      const [budgetsRes, categoriasRes, lancamentosRes] = await Promise.all([
        supabaseAdmin.from('categorias_budget').select('categoria_id, valor_orcado').eq('orcamento_id', orcamento.id),
        supabaseAdmin.from('categorias').select('id, nome, tipo').eq('family_id', familyId),
        supabaseAdmin
          .from('lancamentos')
          .select('categoria_id, valor, status, tipo, data, parcela_total, data_vencimento_fatura')
          .eq('family_id', familyId)
          .in('status', ['pago', 'projetado'])
          .gte('data', `${mesRef}-01`)
          .lte('data', `${mesRef}-31`),
      ])

      const budgets = budgetsRes.data ?? []
      const categorias = categoriasRes.data ?? []
      const lancamentos = lancamentosRes.data ?? []

      totalReceitas = lancamentos
        .filter((l) => l.tipo === 'receita' && l.status === 'pago')
        .reduce((s, l) => s + l.valor, 0)

      const gastosPorCategoria: Record<string, number> = {}
      for (const l of lancamentos) {
        if (l.tipo !== 'despesa') continue
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
        const percentual = budget.valor_orcado > 0 ? Math.round((gasto / budget.valor_orcado) * 10000) / 100 : 0
        envelopes.push({ nome: cat.nome, valor_orcado: budget.valor_orcado, valor_gasto: gasto, disponivel, percentual })
      }
      envelopes.sort((a, b) => b.percentual - a.percentual)
    }

    const totalOrcado = envelopes.reduce((s, e) => s + e.valor_orcado, 0)
    const totalGasto = envelopes.reduce((s, e) => s + e.valor_gasto, 0)
    const totalDisponivel = totalOrcado - totalGasto

    const hoje = new Date()
    const em15Dias = new Date(hoje)
    em15Dias.setDate(em15Dias.getDate() + 15)

    const [contasAVencerRes, caixinhasRes, lancMesAnteriorRes] = await Promise.all([
      supabaseAdmin
        .from('lancamentos')
        .select('descricao, valor, data')
        .eq('family_id', familyId)
        .eq('tipo', 'despesa')
        .in('status', ['projetado', 'pendente'])
        .gte('data', hoje.toISOString().substring(0, 10))
        .lte('data', em15Dias.toISOString().substring(0, 10))
        .order('data', { ascending: true })
        .limit(10),
      supabaseAdmin.from('caixinhas').select('nome, meta, saldo_atual, tipo').eq('family_id', familyId),
      supabaseAdmin
        .from('lancamentos')
        .select('valor, tipo, status')
        .eq('family_id', familyId)
        .eq('status', 'pago')
        .gte('data', `${mesAnterior}-01`)
        .lte('data', `${mesAnterior}-31`),
    ])

    const contasAVencer = contasAVencerRes.data ?? []
    const caixinhas = caixinhasRes.data ?? []
    const lancMesAnterior = lancMesAnteriorRes.data ?? []
    const receitaAnterior = lancMesAnterior.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
    const despesaAnterior = lancMesAnterior.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)

    const linhas: string[] = [
      `=== SITUAÇÃO FINANCEIRA ATUAL (${mesRef}) ===`,
      '',
      `Receitas recebidas este mês: ${formatBRL(totalReceitas)}`,
      `Orçamento total de despesas: ${formatBRL(totalOrcado)}`,
      `Total gasto este mês: ${formatBRL(totalGasto)}`,
      `Saldo disponível no orçamento: ${formatBRL(totalDisponivel)}`,
      '',
      '--- ENVELOPES (categorias de despesa) ---',
    ]

    if (envelopes.length > 0) {
      for (const env of envelopes) {
        const status = env.percentual > 100 ? '🔴' : env.percentual >= 80 ? '🟡' : '🟢'
        linhas.push(`  ${status} ${env.nome}: orçado ${formatBRL(env.valor_orcado)}, gasto ${formatBRL(env.valor_gasto)} (${env.percentual}%), disponível ${formatBRL(env.disponivel)}`)
      }
    } else {
      linhas.push('  (Nenhum orçamento configurado para este mês)')
    }

    if (contasAVencer.length > 0) {
      linhas.push('')
      linhas.push('--- CONTAS A PAGAR NOS PRÓXIMOS 15 DIAS ---')
      for (const c of contasAVencer) {
        linhas.push(`  • ${c.descricao || 'Sem descrição'}: ${formatBRL(c.valor)} (vence ${c.data})`)
      }
    }

    if (caixinhas.length > 0) {
      linhas.push('')
      linhas.push('--- RESERVAS E INVESTIMENTOS (CAIXINHAS) ---')
      for (const cx of caixinhas) {
        const tipo = cx.tipo === 'investimento' ? '📈' : '🐷'
        const meta = cx.meta ? ` / meta: ${formatBRL(cx.meta)}` : ''
        linhas.push(`  ${tipo} ${cx.nome}: ${formatBRL(cx.saldo_atual ?? 0)}${meta}`)
      }
    }

    linhas.push('')
    linhas.push(`--- MÊS ANTERIOR (${mesAnterior}) ---`)
    linhas.push(`  Receitas: ${formatBRL(receitaAnterior)} | Despesas: ${formatBRL(despesaAnterior)} | Resultado: ${formatBRL(receitaAnterior - despesaAnterior)}`)

    const contextoFinanceiro = linhas.join('\n')

    // -------------------------------------------------------------------------
    // 7. HISTÓRICO DE MENSAGENS (janela de contexto)
    // -------------------------------------------------------------------------
    const { data: historico } = await supabaseAdmin
      .from('assistente_mensagens')
      .select('role, conteudo')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_WINDOW)

    const historicoOrdenado = (historico ?? []).reverse()

    // -------------------------------------------------------------------------
    // 8. MONTAR MESSAGES PARA OPENAI
    // -------------------------------------------------------------------------
    const systemPrompt = `${systemBasePrompt}\n\n${contextoFinanceiro}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historicoOrdenado.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.conteudo })),
      { role: 'user', content: mensagem.trim() },
    ]

    // -------------------------------------------------------------------------
    // 9. CHAMAR OPENAI
    // -------------------------------------------------------------------------
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('OPENAI_API_KEY não configurada')
      return jsonResponse({ error: 'Configuração de IA incompleta no servidor' }, 500)
    }

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({ model: OPENAI_MODEL, messages, max_tokens: 500, temperature: 0.7 }),
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
    // 10. SALVAR MENSAGENS E REGISTRAR USO — em try-catch isolado
    // -------------------------------------------------------------------------
    try {
      await Promise.all([
        supabaseAdmin.from('assistente_mensagens').insert([
          { family_id: familyId, user_id: user.id, role: 'user',      conteudo: mensagem.trim(), tone: null },
          { family_id: familyId, user_id: user.id, role: 'assistant', conteudo: resposta, tone },
        ]),
        supabaseAdmin.from('ai_usage_log').insert({
          user_id: user.id,
          mes_referencia: mesAtual,
          feature_type: 'assistente',
        }),
      ])
    } catch (trackErr) {
      console.error('Erro ao salvar mensagens/uso (não bloqueia resposta):', trackErr)
    }

    // -------------------------------------------------------------------------
    // 11. RETORNAR
    // -------------------------------------------------------------------------
    return jsonResponse({
      resposta,
      tone,
      creditos_restantes: limiteManual - usadoManual - 1,
      limite_manual: limiteManual,
    })
  } catch (error) {
    console.error('Erro no assistente-financeiro:', error)
    return jsonResponse({ error: error.message || 'Erro interno do servidor' }, 500)
  }
})
