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
const MAX_TOOL_ROUNDS = 2     // max rodadas de tool calling antes de forçar resposta de texto

// ============================================================================
// TOOL CALLING — consultar_transacoes
// ============================================================================

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'consultar_transacoes',
      description:
        'Consulta lançamentos financeiros com filtros específicos. Use quando o usuário pedir detalhes de transações individuais: maiores gastos, filtrar por categoria/forma de pagamento, histórico de um período, busca por descrição, ranking de despesas, etc. Não use para perguntas que já estão respondidas pelo resumo financeiro do contexto (saldo, total do mês, envelopes).',
      parameters: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['despesa', 'receita'],
            description: 'Tipo de lançamento',
          },
          categoria_nome: {
            type: 'string',
            description: 'Nome (ou parte do nome) da CATEGORIA PAI — busca parcial, case-insensitive. Use para filtrar pela categoria principal (ex: "Alimentação", "Transporte").',
          },
          subcategoria_nome: {
            type: 'string',
            description: 'Nome (ou parte do nome) da SUBCATEGORIA — busca parcial, case-insensitive. Use quando o usuário perguntar sobre uma subcategoria específica (ex: "Combustível", "Aluguel", "Mercado"). Tem prioridade sobre categoria_nome.',
          },
          data_inicio: {
            type: 'string',
            description: 'Data inicial no formato YYYY-MM-DD',
          },
          data_fim: {
            type: 'string',
            description: 'Data final no formato YYYY-MM-DD',
          },
          valor_min: {
            type: 'number',
            description: 'Valor mínimo em reais (inclusive)',
          },
          valor_max: {
            type: 'number',
            description: 'Valor máximo em reais (inclusive)',
          },
          forma_pagamento: {
            type: 'string',
            enum: ['dinheiro', 'debito', 'credito', 'pix', 'transferencia', 'boleto'],
            description: 'Forma de pagamento',
          },
          status: {
            type: 'string',
            enum: ['pago', 'pendente', 'projetado'],
            description: 'Status do lançamento',
          },
          observacao_contem: {
            type: 'string',
            description: 'Texto contido na observação/descrição do lançamento (busca parcial)',
          },
          ordenar_por: {
            type: 'string',
            enum: ['data_desc', 'data_asc', 'valor_desc', 'valor_asc'],
            description: 'Ordenação dos resultados (padrão: data_desc)',
          },
          limite: {
            type: 'integer',
            description: 'Número máximo de resultados a retornar (padrão 20, máximo 50)',
          },
        },
        required: [],
      },
    },
  },
]

async function executeConsultarTransacoes(
  args: Record<string, unknown>,
  familyId: string,
  supabaseAdmin: ReturnType<typeof createClient>,
  categorias: Array<{ id: string; nome: string; tipo: string; categoria_pai_id: string | null }>
): Promise<string> {
  let query = supabaseAdmin
    .from('lancamentos')
    .select('data, valor, tipo, observacao, forma_pagamento, status, categoria_id, subcategoria_id')
    .eq('family_id', familyId)

  if (args.tipo)              query = query.eq('tipo', args.tipo)
  if (args.data_inicio)       query = query.gte('data', args.data_inicio)
  if (args.data_fim)          query = query.lte('data', args.data_fim)
  if (args.valor_min != null) query = query.gte('valor', args.valor_min)
  if (args.valor_max != null) query = query.lte('valor', args.valor_max)
  if (args.forma_pagamento)   query = query.eq('forma_pagamento', args.forma_pagamento)
  if (args.status)            query = query.eq('status', args.status)
  if (args.observacao_contem) {
    query = query.ilike('observacao', `%${args.observacao_contem}%`)
  }

  // Resolve categoria_nome ou subcategoria_nome → ID correto
  // Subcategorias têm categoria_pai_id preenchido e são armazenadas em subcategoria_id
  const subNome = args.subcategoria_nome as string | undefined
  const catNome = args.categoria_nome as string | undefined

  if (subNome) {
    const nomeBusca = subNome.toLowerCase()
    const cat = categorias.find((c) => c.nome.toLowerCase().includes(nomeBusca) && c.categoria_pai_id)
    if (cat) {
      query = query.eq('subcategoria_id', cat.id)
    } else {
      // Subcategoria não encontrada — retorna erro claro em vez de todos os dados
      return JSON.stringify({
        total_encontradas: 0,
        total_valor: 0,
        total_valor_formatado: 'R$ 0,00',
        erro: `Subcategoria "${subNome}" não encontrada. Categorias disponíveis: ${categorias.filter((c) => c.categoria_pai_id).map((c) => c.nome).join(', ')}`,
        transacoes: [],
      })
    }
  } else if (catNome) {
    const nomeBusca = catNome.toLowerCase()
    const cat = categorias.find((c) => c.nome.toLowerCase().includes(nomeBusca) && !c.categoria_pai_id)
    if (cat) {
      query = query.eq('categoria_id', cat.id)
    } else {
      // Categoria raiz não encontrada
      return JSON.stringify({
        total_encontradas: 0,
        total_valor: 0,
        total_valor_formatado: 'R$ 0,00',
        erro: `Categoria "${catNome}" não encontrada. Categorias disponíveis: ${categorias.filter((c) => !c.categoria_pai_id).map((c) => c.nome).join(', ')}`,
        transacoes: [],
      })
    }
  }

  // Ordenação
  const ordem = String(args.ordenar_por ?? 'data_desc')
  const [campoOrdem, dirOrdem] = ordem.split('_')
  query = query.order(
    campoOrdem === 'valor' ? 'valor' : 'data',
    { ascending: dirOrdem === 'asc' }
  )

  // Busca até 500 transações para garantir totais precisos.
  // O total_valor_formatado sempre reflete TODAS as transações do período,
  // e a lista retornada é truncada ao limite pedido pelo AI.
  const detalheLimit = Math.min(Number(args.limite ?? 20), 50)
  query = query.limit(500)

  const { data: rows, error } = await query
  if (error || !rows?.length) {
    return JSON.stringify({ total_encontradas: 0, transacoes: [] })
  }

  const catMap = Object.fromEntries(categorias.map((c) => [c.id, c.nome]))
  const allRows = rows as any[]
  const totalValor = allRows.reduce((s, r) => s + (r.valor ?? 0), 0)
  const displayRows = allRows.slice(0, detalheLimit)

  return JSON.stringify({
    total_encontradas: allRows.length,
    total_valor: Math.round(totalValor * 100) / 100,
    total_valor_formatado: formatBRL(totalValor),
    aviso: allRows.length > detalheLimit
      ? `Mostrando ${detalheLimit} de ${allRows.length} transações. Use total_valor_formatado para o valor correto.`
      : undefined,
    transacoes: displayRows.map((r) => ({
      data: r.data,
      valor: r.valor,
      valor_formatado: formatBRL(r.valor),
      tipo: r.tipo,
      categoria: catMap[r.categoria_id] ?? 'Sem categoria',
      subcategoria: r.subcategoria_id ? (catMap[r.subcategoria_id] ?? null) : null,
      descricao: r.observacao ?? '',
      forma_pagamento: r.forma_pagamento,
      status: r.status,
    })),
  })
}

// ============================================================================
// PERSONALITY PROMPTS
// ============================================================================

const PERSONALITY_PROMPTS: Record<string, string> = {
  conservador: `Você é o PocketWise Assistente, um consultor financeiro pessoal cauteloso e conservador.
Responda perguntas financeiras com foco em riscos, reservas e segurança financeira.
Use SEMPRE os dados reais fornecidos no contexto. Nunca invente números.
Seja direto e recomende cautela quando necessário.
Responda em português brasileiro.

REGRAS DE DATAS E TOTAIS:
- "últimos 3 meses" = do dia 01 do mês há 2 meses atrás até hoje (ex: se hoje é 22/04, use 01/02 a 22/04)
- "mês passado" = do dia 01 ao último dia do mês anterior
- Ao calcular médias ou totais, use SEMPRE o campo total_valor_formatado da resposta do tool — nunca some manualmente os itens da lista, pois ela pode estar truncada
- Se o tool retornar aviso de truncagem, informe o usuário mas use total_valor_formatado como valor correto
- Subcategorias: use subcategoria_nome no tool quando o usuário mencionar algo específico como "combustível", "aluguel", "mercado"`,

  parceiro: `Você é o PocketWise Assistente, um parceiro financeiro pessoal honesto e direto.
Responda perguntas financeiras de forma objetiva e clara, usando os dados reais do contexto.
Não invente dados — se não tiver informação suficiente, diga claramente.
Responda em português brasileiro.

REGRAS DE DATAS E TOTAIS:
- "últimos 3 meses" = do dia 01 do mês há 2 meses atrás até hoje (ex: se hoje é 22/04, use 01/02 a 22/04)
- "mês passado" = do dia 01 ao último dia do mês anterior
- Ao calcular médias ou totais, use SEMPRE o campo total_valor_formatado da resposta do tool — nunca some manualmente os itens da lista, pois ela pode estar truncada
- Se o tool retornar aviso de truncagem, informe o usuário mas use total_valor_formatado como valor correto
- Subcategorias: use subcategoria_nome no tool quando o usuário mencionar algo específico como "combustível", "aluguel", "mercado"`,

  provocador: `Você é o PocketWise Assistente, um consultor financeiro pessoal irônico e provocador.
Responda com provocações saudáveis, desafiando o usuário a pensar — mas SEMPRE com base nos dados reais.
Nunca invente números ou restrições que não existem nos dados.
Responda em português brasileiro.

REGRAS DE DATAS E TOTAIS:
- "últimos 3 meses" = do dia 01 do mês há 2 meses atrás até hoje (ex: se hoje é 22/04, use 01/02 a 22/04)
- "mês passado" = do dia 01 ao último dia do mês anterior
- Ao calcular médias ou totais, use SEMPRE o campo total_valor_formatado da resposta do tool — nunca some manualmente os itens da lista, pois ela pode estar truncada
- Se o tool retornar aviso de truncagem, informe o usuário mas use total_valor_formatado como valor correto
- Subcategorias: use subcategoria_nome no tool quando o usuário mencionar algo específico como "combustível", "aluguel", "mercado"`,

  hype: `Você é o PocketWise Assistente, um parceiro financeiro animado e enérgico!
Responda com entusiasmo — mas NUNCA omita ou distorça os dados reais.
Se a situação for boa, celebre. Se for ruim, seja honesto com energia construtiva.
Responda em português brasileiro.

REGRAS DE DATAS E TOTAIS:
- "últimos 3 meses" = do dia 01 do mês há 2 meses atrás até hoje (ex: se hoje é 22/04, use 01/02 a 22/04)
- "mês passado" = do dia 01 ao último dia do mês anterior
- Ao calcular médias ou totais, use SEMPRE o campo total_valor_formatado da resposta do tool — nunca some manualmente os itens da lista, pois ela pode estar truncada
- Se o tool retornar aviso de truncagem, informe o usuário mas use total_valor_formatado como valor correto
- Subcategorias: use subcategoria_nome no tool quando o usuário mencionar algo específico como "combustível", "aluguel", "mercado"`,
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

function getLastDayOfMonth(mesRef: string): string {
  const [ano, mes] = mesRef.split('-').map(Number)
  const lastDay = new Date(ano, mes, 0).getDate() // day 0 of next month = last day of current
  return `${mesRef}-${String(lastDay).padStart(2, '0')}`
}

function subMonths(mesRef: string, n: number): string {
  const [ano, mes] = mesRef.split('-').map(Number)
  const d = new Date(ano, mes - 1 - n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
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
    const mesRef    = mesAtual
    const mesM1     = subMonths(mesRef, 1)  // mês anterior
    const mesM2     = subMonths(mesRef, 2)  // 2 meses atrás

    // ---- 6a. Orçamento do mês atual (envelopes) -----------------------------
    const { data: orcamento } = await supabaseAdmin
      .from('orcamentos_mensais')
      .select('id')
      .eq('family_id', familyId)
      .eq('mes_referencia', `${mesRef}-01`)
      .maybeSingle()

    type Envelope = { nome: string; valor_orcado: number; valor_gasto: number; disponivel: number; percentual: number }
    let envelopes: Envelope[] = []
    let totalReceitas  = 0  // receitas deste mês (pago + projetado)
    let totalGastoReal = 0  // TODAS as despesas do mês (pago + projetado)

    // ---- 6b. Lançamentos do mês atual + 2 meses anteriores (para média) -----
    const [
      lancAtualRes,
      lancM1Res,
      lancM2Res,
      budgetsRes,
      categoriasRes,
    ] = await Promise.all([
      // Mês atual — pago + projetado
      supabaseAdmin
        .from('lancamentos')
        .select('categoria_id, valor, status, tipo, data, parcela_total, data_vencimento_fatura')
        .eq('family_id', familyId)
        .in('status', ['pago', 'projetado'])
        .gte('data', `${mesRef}-01`)
        .lte('data', getLastDayOfMonth(mesRef)),

      // Mês anterior — pago + projetado
      supabaseAdmin
        .from('lancamentos')
        .select('valor, tipo')
        .eq('family_id', familyId)
        .in('status', ['pago', 'projetado'])
        .gte('data', `${mesM1}-01`)
        .lte('data', getLastDayOfMonth(mesM1)),

      // 2 meses atrás — pago + projetado
      supabaseAdmin
        .from('lancamentos')
        .select('valor, tipo')
        .eq('family_id', familyId)
        .in('status', ['pago', 'projetado'])
        .gte('data', `${mesM2}-01`)
        .lte('data', getLastDayOfMonth(mesM2)),

      // Budgets do orçamento atual (null-safe: só executa se orcamento existir)
      orcamento
        ? supabaseAdmin.from('categorias_budget').select('categoria_id, valor_orcado').eq('orcamento_id', orcamento.id)
        : Promise.resolve({ data: [] }),

      // Categorias da família — inclui categoria_pai_id para distinguir subcategorias
      supabaseAdmin.from('categorias').select('id, nome, tipo, categoria_pai_id').eq('family_id', familyId),
    ])

    const lancAtual    = lancAtualRes.data    ?? []
    const lancM1       = lancM1Res.data       ?? []
    const lancM2       = lancM2Res.data       ?? []
    const budgets      = (budgetsRes as any).data ?? []
    const categorias   = categoriasRes.data   ?? []

    // Receitas do mês atual (pago + projetado — inclui salários lançados como projetado)
    totalReceitas = lancAtual
      .filter((l) => l.tipo === 'receita')
      .reduce((s, l) => s + l.valor, 0)

    // Total de despesas reais do mês (todos os lançamentos, com ou sem categoria orçada)
    totalGastoReal = lancAtual
      .filter((l) => l.tipo === 'despesa')
      .reduce((s, l) => s + l.valor, 0)

    // Receitas dos meses anteriores para média
    const receitaM1 = lancM1.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
    const receitaM2 = lancM2.filter((l) => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0)
    const despesaM1 = lancM1.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)
    const despesaM2 = lancM2.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)

    // Média de receita dos últimos 3 meses (considera apenas meses com dados)
    const mesesComReceita = [totalReceitas, receitaM1, receitaM2].filter((v) => v > 0)
    const receitaMedia = mesesComReceita.length > 0
      ? mesesComReceita.reduce((s, v) => s + v, 0) / mesesComReceita.length
      : 0

    // ---- 6c. Envelopes — apenas categorias de DESPESA -----------------------
    const gastosPorCategoria: Record<string, number> = {}
    for (const l of lancAtual) {
      if (l.tipo !== 'despesa') continue
      // Para parcelas de cartão, usa data_vencimento_fatura como mês de referência
      const mesEnvelope = (l.parcela_total && l.parcela_total > 1 && l.data_vencimento_fatura)
        ? l.data_vencimento_fatura.substring(0, 7)
        : l.data.substring(0, 7)
      if (mesEnvelope === mesRef) {
        gastosPorCategoria[l.categoria_id] = (gastosPorCategoria[l.categoria_id] ?? 0) + l.valor
      }
    }

    for (const budget of budgets) {
      // Filtra apenas categorias de DESPESA — evita inflar totalOrcado com receitas
      const cat = categorias.find((c) => c.id === budget.categoria_id && c.tipo === 'despesa')
      if (!cat) continue
      const gasto      = Math.round((gastosPorCategoria[budget.categoria_id] ?? 0) * 100) / 100
      const disponivel = Math.round((budget.valor_orcado - gasto) * 100) / 100
      const percentual = budget.valor_orcado > 0 ? Math.round((gasto / budget.valor_orcado) * 10000) / 100 : 0
      envelopes.push({ nome: cat.nome, valor_orcado: budget.valor_orcado, valor_gasto: gasto, disponivel, percentual })
    }
    envelopes.sort((a, b) => b.percentual - a.percentual)

    const totalOrcado    = envelopes.reduce((s, e) => s + e.valor_orcado, 0)
    const totalGastoEnv  = envelopes.reduce((s, e) => s + e.valor_gasto, 0)  // gasto dentro de envelopes
    const totalDisponivel = totalOrcado - totalGastoReal  // disponível real = orçado - tudo gasto

    // ---- 6d. Consultas paralelas finais -------------------------------------
    const hoje    = new Date()
    const em15Dias = new Date(hoje)
    em15Dias.setDate(em15Dias.getDate() + 15)

    const [contasAVencerRes, caixinhasRes] = await Promise.all([
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

      // Caixinhas ativas — campos corretos incluindo valor_mercado para investimentos
      supabaseAdmin
        .from('caixinhas')
        .select('nome, meta_valor, saldo_atual, valor_mercado, subtipo_investimento, tipo')
        .eq('family_id', familyId)
        .eq('ativa', true),
    ])

    const contasAVencer = contasAVencerRes.data ?? []
    const caixinhas     = caixinhasRes.data     ?? []

    // ---- 6e. Montar texto do contexto ---------------------------------------
    const linhas: string[] = [
      `=== SITUAÇÃO FINANCEIRA ATUAL (${mesRef}) ===`,
      '',
      `Receitas deste mês (pago + previsto): ${formatBRL(totalReceitas)}`,
      `Receita média (últimos 3 meses): ${formatBRL(receitaMedia)}`,
      `Total de despesas deste mês: ${formatBRL(totalGastoReal)}`,
      `Orçamento total de despesas (envelopes): ${formatBRL(totalOrcado)}`,
      `Gasto via envelopes: ${formatBRL(totalGastoEnv)}`,
      `Saldo disponível (orçado - gasto real): ${formatBRL(totalDisponivel)}`,
      '',
      '--- ENVELOPES DE DESPESA ---',
    ]

    if (envelopes.length > 0) {
      for (const env of envelopes) {
        const status = env.percentual > 100 ? '🔴' : env.percentual >= 80 ? '🟡' : '🟢'
        linhas.push(`  ${status} ${env.nome}: orçado ${formatBRL(env.valor_orcado)}, gasto ${formatBRL(env.valor_gasto)} (${env.percentual}%), disponível ${formatBRL(env.disponivel)}`)
      }
    } else {
      linhas.push('  (Nenhum orçamento de despesas configurado para este mês)')
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
        const icone = cx.tipo === 'investimento' ? '📈' : cx.tipo === 'emergencia' ? '🛡️' : '🐷'
        const meta  = cx.meta_valor ? ` / meta: ${formatBRL(cx.meta_valor)}` : ''
        // Para investimentos: mostra valor de mercado se disponível, senão saldo aportado
        const valorExibido = (cx.tipo === 'investimento' && cx.valor_mercado != null)
          ? cx.valor_mercado
          : (cx.saldo_atual ?? 0)
        const infoAporte = (cx.tipo === 'investimento' && cx.valor_mercado != null)
          ? ` (total aportado: ${formatBRL(cx.saldo_atual ?? 0)})`
          : ''
        const subtipo = cx.subtipo_investimento ? ` [${cx.subtipo_investimento}]` : ''
        linhas.push(`  ${icone} ${cx.nome}${subtipo}: ${formatBRL(valorExibido)}${infoAporte}${meta}`)
      }
    } else {
      linhas.push('')
      linhas.push('--- RESERVAS E INVESTIMENTOS (CAIXINHAS) ---')
      linhas.push('  (Nenhuma caixinha cadastrada)')
    }

    linhas.push('')
    linhas.push(`--- HISTÓRICO MENSAL ---`)
    linhas.push(`  ${mesM1}: Receitas ${formatBRL(receitaM1)} | Despesas ${formatBRL(despesaM1)} | Resultado ${formatBRL(receitaM1 - despesaM1)}`)
    linhas.push(`  ${mesM2}: Receitas ${formatBRL(receitaM2)} | Despesas ${formatBRL(despesaM2)} | Resultado ${formatBRL(receitaM2 - despesaM2)}`)

    // Lista categorias e subcategorias para orientar o tool calling
    linhas.push('')
    linhas.push('--- CATEGORIAS E SUBCATEGORIAS DISPONÍVEIS ---')
    linhas.push('  (Use subcategoria_nome no tool para filtrar subcategorias específicas)')

    const catsRaizDespesa = (categorias as any[]).filter((c) => c.tipo === 'despesa' && !c.categoria_pai_id)
    const catsRaizReceita = (categorias as any[]).filter((c) => c.tipo === 'receita' && !c.categoria_pai_id)
    const subMap = (categorias as any[])
      .filter((c) => c.categoria_pai_id)
      .reduce((acc: Record<string, string[]>, c) => {
        acc[c.categoria_pai_id] = acc[c.categoria_pai_id] ?? []
        acc[c.categoria_pai_id].push(c.nome)
        return acc
      }, {})

    linhas.push('  Despesas:')
    for (const c of catsRaizDespesa) {
      const subs = subMap[c.id]
      if (subs?.length) {
        linhas.push(`    • ${c.nome} → subcategorias: ${subs.join(', ')}`)
      } else {
        linhas.push(`    • ${c.nome}`)
      }
    }
    if (catsRaizReceita.length > 0) {
      linhas.push('  Receitas:')
      for (const c of catsRaizReceita) {
        const subs = subMap[c.id]
        if (subs?.length) {
          linhas.push(`    • ${c.nome} → subcategorias: ${subs.join(', ')}`)
        } else {
          linhas.push(`    • ${c.nome}`)
        }
      }
    }

    const contextoFinanceiro = linhas.join('\n')

    // -------------------------------------------------------------------------
    // 7. REFERÊNCIAS DE DATA PRÉ-COMPUTADAS
    // (adicionadas ao system prompt para o AI não precisar calcular datas)
    // -------------------------------------------------------------------------
    const hoje = new Date()
    const hojeStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    const mes3atrás = subMonths(mesRef, 2)
    const mes6atrás = subMonths(mesRef, 5)
    const mes12atrás = subMonths(mesRef, 11)

    const dataBlocoLinhas = [
      '',
      '--- REFERÊNCIAS DE DATA (USE EXATAMENTE ESTES VALORES NO TOOL) ---',
      `  Hoje: ${hojeStr}`,
      `  Mês atual (até hoje):     data_inicio=${mesRef}-01  data_fim=${hojeStr}`,
      `  Mês passado (completo):   data_inicio=${mesM1}-01  data_fim=${getLastDayOfMonth(mesM1)}`,
      `  2 meses atrás (completo): data_inicio=${mesM2}-01  data_fim=${getLastDayOfMonth(mesM2)}`,
      `  Últimos 3 meses (${mes3atrás}, ${mesM1}, ${mesRef}): data_inicio=${mes3atrás}-01  data_fim=${hojeStr}`,
      `  Últimos 6 meses:  data_inicio=${mes6atrás}-01  data_fim=${hojeStr}`,
      `  Últimos 12 meses: data_inicio=${mes12atrás}-01  data_fim=${hojeStr}`,
      '  IMPORTANTE: nunca calcule datas — copie exatamente os valores acima.',
    ]
    const contextoComDatas = contextoFinanceiro + dataBlocoLinhas.join('\n')

    // -------------------------------------------------------------------------
    // 8. HISTÓRICO DE MENSAGENS (janela de contexto)
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
    const systemPrompt = `${systemBasePrompt}\n\n${contextoComDatas}`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...historicoOrdenado.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.conteudo })),
      { role: 'user', content: mensagem.trim() },
    ]

    // -------------------------------------------------------------------------
    // 9. CHAMAR OPENAI (com tool calling para consultas de transações)
    // -------------------------------------------------------------------------
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiKey) {
      console.error('OPENAI_API_KEY não configurada')
      return jsonResponse({ error: 'Configuração de IA incompleta no servidor' }, 500)
    }

    let currentMessages: unknown[] = [...messages]
    let finalResposta = ''

    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      // Na última rodada remove tools para forçar resposta de texto (evita loop infinito)
      const isLastRound = round === MAX_TOOL_ROUNDS

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: currentMessages,
          tools: isLastRound ? undefined : TOOLS,
          tool_choice: isLastRound ? undefined : 'auto',
          max_tokens: 800,
          temperature: 0.7,
        }),
      })

      if (!openaiRes.ok) {
        const errText = await openaiRes.text()
        console.error('OpenAI error:', errText)
        return jsonResponse({ error: 'Erro ao consultar a IA. Tente novamente.' }, 502)
      }

      const openaiData = await openaiRes.json()
      const choice = openaiData.choices?.[0]

      // A IA quer executar uma tool call
      if (!isLastRound && choice?.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length) {
        currentMessages.push(choice.message)

        for (const toolCall of choice.message.tool_calls) {
          let toolResult = ''
          if (toolCall.function?.name === 'consultar_transacoes') {
            try {
              const args = JSON.parse(toolCall.function.arguments ?? '{}')
              toolResult = await executeConsultarTransacoes(args, familyId, supabaseAdmin, categorias)
            } catch (e) {
              toolResult = JSON.stringify({ erro: 'Falha ao executar consulta', detalhe: String(e) })
            }
          }
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: toolResult,
          })
        }
        // Próxima rodada com os resultados da tool injetados
        continue
      }

      // Resposta final de texto
      finalResposta = choice?.message?.content ?? ''
      break
    }

    if (!finalResposta) {
      return jsonResponse({ error: 'A IA não retornou uma resposta válida.' }, 502)
    }

    // -------------------------------------------------------------------------
    // 10. SALVAR MENSAGENS E REGISTRAR USO — em try-catch isolado
    // -------------------------------------------------------------------------
    try {
      const now = new Date()
      const nowUser = now.toISOString()
      const nowIA   = new Date(now.getTime() + 1).toISOString() // +1ms garante ordem correta
      await Promise.all([
        supabaseAdmin.from('assistente_mensagens').insert([
          { family_id: familyId, user_id: user.id, role: 'user',      conteudo: mensagem.trim(), tone: null, created_at: nowUser },
          { family_id: familyId, user_id: user.id, role: 'assistant', conteudo: finalResposta, tone,         created_at: nowIA  },
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
      resposta: finalResposta,
      tone,
      creditos_restantes: limiteManual - usadoManual - 1,
      limite_manual: limiteManual,
    })
  } catch (error) {
    console.error('Erro no assistente-financeiro:', error)
    return jsonResponse({ error: error.message || 'Erro interno do servidor' }, 500)
  }
})
