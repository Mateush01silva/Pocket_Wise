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
const HISTORY_WINDOW = 10 // últimas N mensagens usadas como contexto

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

function getPreviousMes(mesRef: string): string {
  const [year, month] = mesRef.split('-').map(Number)
  const d = new Date(year, month - 2, 1) // month-2 porque month é 1-based
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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

    // Busca pelo user_id (mais rápido após primeiro acesso)
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
      // Fallback pelo email (seeds sem user_id vinculado)
      const { data: accessByEmail } = await supabaseAdmin
        .from('ai_feature_access')
        .select('id, enabled')
        .eq('email', user.email ?? '')
        .maybeSingle()

      if (!accessByEmail || !accessByEmail.enabled) {
        return jsonResponse({ error: 'Acesso à IA não disponível para este usuário', code: 'FEATURE_NOT_ENABLED' }, 403)
      }
      accessId = accessByEmail.id

      // Vincula user_id para futuros lookups
      if (!accessByEmail.user_id) {
        await supabaseAdmin
          .from('ai_feature_access')
          .update({ user_id: user.id, updated_at: new Date().toISOString() })
          .eq('id', accessId)
      }
    }

    // Verifica permissão específica da funcionalidade 'assistente'
    const { data: permission } = await supabaseAdmin
      .from('ai_feature_permissions')
      .select('enabled')
      .eq('access_id', accessId)
      .eq('feature_key', 'assistente')
      .maybeSingle()

    if (!permission || !permission.enabled) {
      return jsonResponse({ error: 'Funcionalidade Assistente não habilitada para este usuário', code: 'FEATURE_NOT_ENABLED' }, 403)
    }

    // -------------------------------------------------------------------------
    // 3. LER BODY
    // -------------------------------------------------------------------------
    const { mensagem, family_id: familyId } = await req.json()

    if (!mensagem || typeof mensagem !== 'string' || mensagem.trim().length < 2) {
      return jsonResponse({ error: 'Mensagem inválida ou muito curta' }, 400)
    }

    if (!familyId) {
      return jsonResponse({ error: 'family_id não fornecido' }, 400)
    }

    // -------------------------------------------------------------------------
    // 4. TOM DE PERSONALIDADE
    // -------------------------------------------------------------------------
    const { data: prefData } = await supabaseAdmin
      .from('user_ai_preferences')
      .select('personality_tone')
      .eq('user_id', user.id)
      .maybeSingle()

    const tone = prefData?.personality_tone ?? 'parceiro'
    const systemBasePrompt = PERSONALITY_PROMPTS[tone] ?? PERSONALITY_PROMPTS['parceiro']

    // -------------------------------------------------------------------------
    // 5. MONTAR CONTEXTO FINANCEIRO
    // -------------------------------------------------------------------------
    const mesRef = getCurrentMes()
    const mesAnterior = getPreviousMes(mesRef)

    // --- Envelopes do mês atual ---
    const { data: orcamento } = await supabaseAdmin
      .from('orcamentos_mensais')
      .select('id')
      .eq('family_id', familyId)
      .eq('mes_referencia', `${mesRef}-01`)
      .maybeSingle()

    type Envelope = {
      nome: string
      valor_orcado: number
      valor_gasto: number
      disponivel: number
      percentual: number
    }

    let envelopes: Envelope[] = []
    let totalReceitas = 0

    if (orcamento) {
      const [budgetsRes, categoriasRes, lancamentosRes] = await Promise.all([
        supabaseAdmin
          .from('categorias_budget')
          .select('categoria_id, valor_orcado')
          .eq('orcamento_id', orcamento.id),
        supabaseAdmin
          .from('categorias')
          .select('id, nome, tipo')
          .eq('family_id', familyId),
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

      // Totais de receita do mês
      totalReceitas = lancamentos
        .filter((l) => l.tipo === 'receita' && l.status === 'pago')
        .reduce((s, l) => s + l.valor, 0)

      // Gastos por categoria (replica lógica de envelope)
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
        const percentual = budget.valor_orcado > 0
          ? Math.round((gasto / budget.valor_orcado) * 10000) / 100
          : 0
        envelopes.push({ nome: cat.nome, valor_orcado: budget.valor_orcado, valor_gasto: gasto, disponivel, percentual })
      }
      envelopes.sort((a, b) => b.percentual - a.percentual)
    }

    const totalOrcado = envelopes.reduce((s, e) => s + e.valor_orcado, 0)
    const totalGasto = envelopes.reduce((s, e) => s + e.valor_gasto, 0)
    const totalDisponivel = totalOrcado - totalGasto

    // --- Contas a vencer nos próximos 15 dias ---
    const hoje = new Date()
    const em15Dias = new Date(hoje)
    em15Dias.setDate(em15Dias.getDate() + 15)
    const hojeStr = hoje.toISOString().substring(0, 10)
    const em15DiasStr = em15Dias.toISOString().substring(0, 10)

    const { data: contasAVencer } = await supabaseAdmin
      .from('lancamentos')
      .select('descricao, valor, data, categoria_id')
      .eq('family_id', familyId)
      .eq('tipo', 'despesa')
      .in('status', ['projetado', 'pendente'])
      .gte('data', hojeStr)
      .lte('data', em15DiasStr)
      .order('data', { ascending: true })
      .limit(10)

    // --- Caixinhas / Reservas ---
    const { data: caixinhas } = await supabaseAdmin
      .from('caixinhas')
      .select('nome, meta, saldo_atual, tipo')
      .eq('family_id', familyId)

    // --- Resumo do mês anterior ---
    const { data: lancMesAnterior } = await supabaseAdmin
      .from('lancamentos')
      .select('valor, tipo, status')
      .eq('family_id', familyId)
      .in('status', ['pago'])
      .gte('data', `${mesAnterior}-01`)
      .lte('data', `${mesAnterior}-31`)

    const receitaAnterior = (lancMesAnterior ?? [])
      .filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
    const despesaAnterior = (lancMesAnterior ?? [])
      .filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)

    // --- Montar texto do contexto ---
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

    if (contasAVencer && contasAVencer.length > 0) {
      linhas.push('')
      linhas.push('--- CONTAS A PAGAR NOS PRÓXIMOS 15 DIAS ---')
      for (const c of contasAVencer) {
        linhas.push(`  • ${c.descricao || 'Sem descrição'}: ${formatBRL(c.valor)} (vence ${c.data})`)
      }
    }

    if (caixinhas && caixinhas.length > 0) {
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
    // 6. HISTÓRICO DE MENSAGENS (janela de contexto)
    // -------------------------------------------------------------------------
    const { data: historico } = await supabaseAdmin
      .from('assistente_mensagens')
      .select('role, conteudo')
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })
      .limit(HISTORY_WINDOW)

    // Histórico vem em ordem DESC, precisa inverter para ordem cronológica
    const historicoOrdenado = (historico ?? []).reverse()

    // -------------------------------------------------------------------------
    // 7. MONTAR MESSAGES PARA OPENAI
    // -------------------------------------------------------------------------
    const systemPrompt = `${systemBasePrompt}

${contextoFinanceiro}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historicoOrdenado.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.conteudo,
      })),
      { role: 'user', content: mensagem.trim() },
    ]

    // -------------------------------------------------------------------------
    // 8. CHAMAR OPENAI
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
        messages,
        max_tokens: 500,
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
    // 9. SALVAR MENSAGENS NO BANCO
    // -------------------------------------------------------------------------
    await supabaseAdmin.from('assistente_mensagens').insert([
      {
        family_id: familyId,
        user_id: user.id,
        role: 'user',
        conteudo: mensagem.trim(),
        tone: null,
      },
      {
        family_id: familyId,
        user_id: user.id,
        role: 'assistant',
        conteudo: resposta,
        tone,
      },
    ])

    // -------------------------------------------------------------------------
    // 10. RETORNAR
    // -------------------------------------------------------------------------
    return jsonResponse({ resposta, tone })
  } catch (error) {
    console.error('Erro no assistente-financeiro:', error)
    return jsonResponse({ error: error.message || 'Erro interno do servidor' }, 500)
  }
})
