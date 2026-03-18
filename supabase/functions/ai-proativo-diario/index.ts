import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// CONSTANTS
// ============================================================================

const TOTAL_LIMIT   = 30
const OPENAI_MODEL  = 'gpt-4o-mini'
const COOLDOWN_DAYS = 7     // dias de cooldown por gatilho
const MAX_TOKENS    = 350   // proativas são curtas e diretas

// ============================================================================
// TRIGGER KEYS
// ============================================================================

const T = {
  ENVELOPE_ESTOURADO_2X   : 'envelope_estourado_2x',     // sufixo _{cat_id}
  SEM_LANCAMENTOS_7DIAS   : 'sem_lancamentos_7dias',
  CONTA_SEM_COBERTURA     : 'conta_sem_cobertura',        // sufixo _{lancamento_id}
  META_ATINGIDA           : 'meta_reserva_atingida',      // sufixo _{caixinha_id}
  DESEQUILIBRIO_CASAL     : 'desequilibrio_casal_2x',
  FECHAMENTO_TODOS_OK     : 'fechamento_todos_envelopes_ok',
  RESUMO_MENSAL           : 'resumo_mensal',
} as const

// Gatilhos de alerta (chip vermelho no chat) vs análise (chip âmbar)
const ALERT_TRIGGERS = new Set([
  T.ENVELOPE_ESTOURADO_2X,
  T.CONTA_SEM_COBERTURA,
  T.DESEQUILIBRIO_CASAL,
])

// Prioridade: quanto menor, mais urgente
const PRIORITY: Record<string, number> = {
  [T.CONTA_SEM_COBERTURA]   : 1,
  [T.ENVELOPE_ESTOURADO_2X] : 2,
  [T.DESEQUILIBRIO_CASAL]   : 3,
  [T.SEM_LANCAMENTOS_7DIAS] : 4,
  [T.META_ATINGIDA]         : 5,
  [T.RESUMO_MENSAL]         : 6,
  [T.FECHAMENTO_TODOS_OK]   : 7,
}

// ============================================================================
// TIPOS
// ============================================================================

interface FiredTrigger {
  key: string                      // chave única para cooldown (pode ter sufixo)
  baseKey: string                  // chave sem sufixo (para o campo trigger_key)
  priority: number
  triggerContext: string           // texto a enviar ao GPT descrevendo a situação
  metadata: Record<string, unknown>
}

type SupabaseAdmin = ReturnType<typeof createClient>

// ============================================================================
// HELPERS
// ============================================================================

function getMesAtual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function getMesAnterior(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function getMesDoisAtras(): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function mesLabel(mes: string): string {
  const [year, month] = mes.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

// ============================================================================
// PERSONALIDADE
// ============================================================================

const PERSONALITY_PROMPTS: Record<string, string> = {
  conservador: `Você é o PocketWise, um assistente financeiro proativo e conservador. Monitora as finanças do usuário silenciosamente e envia alertas quando detecta riscos. Seja cauteloso, direto e cite os números exatos.`,
  parceiro   : `Você é o PocketWise, um assistente financeiro proativo. Acompanha as finanças do usuário e envia análises e alertas úteis de forma honesta e direta.`,
  provocador : `Você é o PocketWise, um assistente financeiro proativo e irônico. Detectou algo relevante e vai comunicar sem rodeios — talvez com uma provocação saudável. Mas sempre com dados reais.`,
  hype       : `Você é o PocketWise, um assistente financeiro proativo e animado. Quando detecta algo importante, avisa com energia — seja para celebrar uma conquista ou alertar sobre um risco.`,
}

// ============================================================================
// CONSTRUTOR DO CONTEXTO FINANCEIRO (similar ao assistente-financeiro)
// ============================================================================

async function buildFinancialContext(
  supabase: SupabaseAdmin,
  familyId: string,
  mesRef: string
): Promise<string> {
  const mesStart = `${mesRef}-01`
  const mesEnd   = `${mesRef}-31`

  const { data: orcamento } = await supabase
    .from('orcamentos_mensais')
    .select('id')
    .eq('family_id', familyId)
    .eq('mes_referencia', mesStart)
    .maybeSingle()

  type Envelope = { nome: string; valor_orcado: number; valor_gasto: number; disponivel: number; percentual: number }
  let envelopes: Envelope[] = []
  let totalReceitas = 0

  if (orcamento) {
    const [budgetsRes, categoriasRes, lancamentosRes] = await Promise.all([
      supabase.from('categorias_budget').select('categoria_id, valor_orcado').eq('orcamento_id', orcamento.id),
      supabase.from('categorias').select('id, nome, tipo').eq('family_id', familyId),
      supabase
        .from('lancamentos')
        .select('categoria_id, valor, status, tipo, data, parcela_total, data_vencimento_fatura')
        .eq('family_id', familyId)
        .in('status', ['pago', 'projetado'])
        .gte('data', mesStart)
        .lte('data', mesEnd),
    ])

    const budgets     = budgetsRes.data ?? []
    const categorias  = categoriasRes.data ?? []
    const lancamentos = lancamentosRes.data ?? []

    totalReceitas = lancamentos
      .filter((l) => l.tipo === 'receita' && l.status === 'pago')
      .reduce((s, l) => s + l.valor, 0)

    const gastos: Record<string, number> = {}
    for (const l of lancamentos) {
      if (l.tipo !== 'despesa') continue
      const mesEnv = (l.parcela_total > 1 && l.data_vencimento_fatura)
        ? l.data_vencimento_fatura.substring(0, 7)
        : l.data.substring(0, 7)
      if (mesEnv === mesRef) {
        gastos[l.categoria_id] = (gastos[l.categoria_id] ?? 0) + l.valor
      }
    }

    for (const b of budgets) {
      const cat = categorias.find((c) => c.id === b.categoria_id)
      if (!cat) continue
      const gasto      = Math.round((gastos[b.categoria_id] ?? 0) * 100) / 100
      const disponivel = Math.round((b.valor_orcado - gasto) * 100) / 100
      const percentual = b.valor_orcado > 0 ? Math.round((gasto / b.valor_orcado) * 10000) / 100 : 0
      envelopes.push({ nome: cat.nome, valor_orcado: b.valor_orcado, valor_gasto: gasto, disponivel, percentual })
    }
    envelopes.sort((a, b) => b.percentual - a.percentual)
  }

  const totalOrcado    = envelopes.reduce((s, e) => s + e.valor_orcado, 0)
  const totalGasto     = envelopes.reduce((s, e) => s + e.valor_gasto, 0)
  const totalDisponivel = totalOrcado - totalGasto

  const linhas = [
    `=== CONTEXTO FINANCEIRO (${mesLabel(mesRef)}) ===`,
    `Receitas recebidas: ${formatBRL(totalReceitas)}`,
    `Orçamento total: ${formatBRL(totalOrcado)}  |  Gasto: ${formatBRL(totalGasto)}  |  Disponível: ${formatBRL(totalDisponivel)}`,
    '',
    'ENVELOPES:',
  ]

  if (envelopes.length > 0) {
    for (const e of envelopes) {
      const s = e.percentual > 100 ? '🔴' : e.percentual >= 80 ? '🟡' : '🟢'
      linhas.push(`  ${s} ${e.nome}: orçado ${formatBRL(e.valor_orcado)}, gasto ${formatBRL(e.valor_gasto)} (${e.percentual}%), disponível ${formatBRL(e.disponivel)}`)
    }
  } else {
    linhas.push('  (Nenhum orçamento configurado para este mês)')
  }

  return linhas.join('\n')
}

// ============================================================================
// AVALIADORES DE GATILHO
// ============================================================================

async function evaluateEnvelopeEstourado2x(
  supabase: SupabaseAdmin,
  userId: string,
  familyId: string,
  mesRef: string
): Promise<FiredTrigger[]> {
  const mesStart = `${mesRef}-01`
  const mesEnd   = `${mesRef}-31`

  const { data: orcamento } = await supabase
    .from('orcamentos_mensais')
    .select('id')
    .eq('family_id', familyId)
    .eq('mes_referencia', mesStart)
    .maybeSingle()

  if (!orcamento) return []

  const [budgetsRes, categoriasRes, lancamentosRes] = await Promise.all([
    supabase.from('categorias_budget').select('categoria_id, valor_orcado').eq('orcamento_id', orcamento.id),
    supabase.from('categorias').select('id, nome').eq('family_id', familyId),
    supabase
      .from('lancamentos')
      .select('categoria_id, valor, data, parcela_total, data_vencimento_fatura')
      .eq('family_id', familyId)
      .eq('tipo', 'despesa')
      .in('status', ['pago', 'projetado'])
      .gte('data', mesStart)
      .lte('data', mesEnd),
  ])

  const budgets     = budgetsRes.data ?? []
  const categorias  = categoriasRes.data ?? []
  const lancamentos = lancamentosRes.data ?? []

  const gastos: Record<string, number> = {}
  for (const l of lancamentos) {
    const mesEnv = (l.parcela_total > 1 && l.data_vencimento_fatura)
      ? l.data_vencimento_fatura.substring(0, 7)
      : l.data.substring(0, 7)
    if (mesEnv === mesRef) {
      gastos[l.categoria_id] = (gastos[l.categoria_id] ?? 0) + l.valor
    }
  }

  const triggers: FiredTrigger[] = []
  for (const b of budgets) {
    const gasto = gastos[b.categoria_id] ?? 0
    if (gasto <= b.valor_orcado) continue

    const cat     = categorias.find((c) => c.id === b.categoria_id)
    if (!cat) continue

    const triggerKey = `${T.ENVELOPE_ESTOURADO_2X}_${b.categoria_id}`

    // Só dispara na 2ª vez: deve existir log ANTERIOR deste trigger_key neste mês
    const mesInicioTimestamp = new Date(`${mesRef}-01T00:00:00Z`).toISOString()
    const { data: logExistente } = await supabase
      .from('ai_proactive_trigger_log')
      .select('id')
      .eq('user_id', userId)
      .eq('trigger_key', triggerKey)
      .gte('triggered_at', mesInicioTimestamp)
      .limit(1)
      .maybeSingle()

    if (!logExistente) {
      // Primeira ocorrência no mês — ainda não registrar, só cria o log inicial
      // sem gerar mensagem (o log inicial serve como marcador)
      await supabase.from('ai_proactive_trigger_log').insert({
        user_id: userId, family_id: familyId, trigger_key: triggerKey,
        metadata: { nome: cat.nome, primeira_ocorrencia: true },
      })
      continue
    }

    // Segunda+ ocorrência: gera a mensagem
    const deficit     = Math.round((gasto - b.valor_orcado) * 100) / 100
    const percentual  = Math.round((gasto / b.valor_orcado) * 10000) / 100

    triggers.push({
      key            : triggerKey,
      baseKey        : T.ENVELOPE_ESTOURADO_2X,
      priority       : PRIORITY[T.ENVELOPE_ESTOURADO_2X],
      triggerContext : `[ALERTA: ENVELOPE ESTOURADO PELA 2ª VEZ]\n`
                     + `Envelope: "${cat.nome}"\n`
                     + `Orçado: ${formatBRL(b.valor_orcado)}\n`
                     + `Gasto até hoje: ${formatBRL(gasto)} (${percentual}% do orçamento)\n`
                     + `Déficit confirmado: ${formatBRL(deficit)}\n`
                     + `Contexto: Este envelope já foi identificado como estourado anteriormente neste mês — a situação persiste.\n`
                     + `\nGere um alerta direto e personalizado sobre este envelope. Use os números acima. Não invente valores. (3-4 linhas)`,
      metadata       : { nome: cat.nome, valor_orcado: b.valor_orcado, valor_gasto: gasto, deficit, percentual },
    })
    break // Máximo 1 envelope por disparo diário (o mais estourado já sai em 1º)
  }

  return triggers
}

// ----------------------------------------------------------------------------

async function evaluateSemLancamentos7Dias(
  supabase: SupabaseAdmin,
  familyId: string
): Promise<FiredTrigger | null> {
  const seteAtras = new Date()
  seteAtras.setDate(seteAtras.getDate() - 7)
  const dataLimite = seteAtras.toISOString().substring(0, 10)

  const { count } = await supabase
    .from('lancamentos')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .gte('data', dataLimite)

  if ((count ?? 0) > 0) return null

  return {
    key            : T.SEM_LANCAMENTOS_7DIAS,
    baseKey        : T.SEM_LANCAMENTOS_7DIAS,
    priority       : PRIORITY[T.SEM_LANCAMENTOS_7DIAS],
    triggerContext : `[ANÁLISE: SEM REGISTROS NOS ÚLTIMOS 7 DIAS]\n`
                   + `Não há nenhum lançamento registrado nos últimos 7 dias (desde ${dataLimite}).\n`
                   + `\nGere uma mensagem curta perguntando se está tudo bem com o controle financeiro e incentivando o usuário a manter os registros em dia. Seja natural e humano, não robótico. (2-3 linhas)`,
    metadata       : { ultimos_7_dias_sem_lancamento: true, data_limite: dataLimite },
  }
}

// ----------------------------------------------------------------------------

async function evaluateContaSemCobertura(
  supabase: SupabaseAdmin,
  familyId: string,
  mesRef: string
): Promise<FiredTrigger[]> {
  const hoje   = new Date()
  const em5    = new Date(hoje)
  em5.setDate(em5.getDate() + 5)

  const mesStart = `${mesRef}-01`
  const mesEnd   = `${mesRef}-31`

  // Contas a vencer nos próximos 5 dias
  const { data: contas } = await supabase
    .from('lancamentos')
    .select('id, descricao, valor, data, categoria_id')
    .eq('family_id', familyId)
    .eq('tipo', 'despesa')
    .in('status', ['projetado', 'pendente'])
    .gte('data', hoje.toISOString().substring(0, 10))
    .lte('data', em5.toISOString().substring(0, 10))
    .order('data', { ascending: true })

  if (!contas?.length) return []

  // Gastos já realizados por categoria este mês
  const { data: orcamento } = await supabase
    .from('orcamentos_mensais').select('id')
    .eq('family_id', familyId).eq('mes_referencia', mesStart).maybeSingle()

  const disponivelPorCategoria: Record<string, { disponivel: number; nome: string }> = {}

  if (orcamento) {
    const [budgetsRes, categoriasRes, gastoRes] = await Promise.all([
      supabase.from('categorias_budget').select('categoria_id, valor_orcado').eq('orcamento_id', orcamento.id),
      supabase.from('categorias').select('id, nome').eq('family_id', familyId),
      supabase
        .from('lancamentos')
        .select('categoria_id, valor, data, parcela_total, data_vencimento_fatura')
        .eq('family_id', familyId).eq('tipo', 'despesa').eq('status', 'pago')
        .gte('data', mesStart).lte('data', mesEnd),
    ])

    const budgets     = budgetsRes.data ?? []
    const categorias  = categoriasRes.data ?? []
    const gastos: Record<string, number> = {}

    for (const l of gastoRes.data ?? []) {
      const mesEnv = (l.parcela_total > 1 && l.data_vencimento_fatura)
        ? l.data_vencimento_fatura.substring(0, 7)
        : l.data.substring(0, 7)
      if (mesEnv === mesRef) {
        gastos[l.categoria_id] = (gastos[l.categoria_id] ?? 0) + l.valor
      }
    }

    for (const b of budgets) {
      const cat = categorias.find((c) => c.id === b.categoria_id)
      if (!cat) continue
      disponivelPorCategoria[b.categoria_id] = {
        disponivel : Math.round((b.valor_orcado - (gastos[b.categoria_id] ?? 0)) * 100) / 100,
        nome       : cat.nome,
      }
    }
  }

  const triggers: FiredTrigger[] = []
  for (const conta of contas) {
    const env = conta.categoria_id ? disponivelPorCategoria[conta.categoria_id] : null
    if (!env) continue  // Sem envelope → não é possível avaliar cobertura
    if (env.disponivel >= conta.valor) continue  // Coberto

    const diasRestantes = Math.ceil((new Date(conta.data).getTime() - hoje.getTime()) / 86400000)
    const deficit       = Math.round((conta.valor - env.disponivel) * 100) / 100

    triggers.push({
      key            : `${T.CONTA_SEM_COBERTURA}_${conta.id}`,
      baseKey        : T.CONTA_SEM_COBERTURA,
      priority       : PRIORITY[T.CONTA_SEM_COBERTURA],
      triggerContext : `[ALERTA: CONTA A VENCER SEM COBERTURA]\n`
                     + `Conta: "${conta.descricao || 'Sem descrição'}"\n`
                     + `Valor: ${formatBRL(conta.valor)}\n`
                     + `Vencimento: ${conta.data} (em ${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''})\n`
                     + `Envelope relacionado: "${env.nome}"\n`
                     + `Disponível no envelope: ${formatBRL(env.disponivel)}\n`
                     + `Déficit para cobrir: ${formatBRL(deficit)}\n`
                     + `\nGere um alerta urgente e direto sobre esta conta. Use os valores exatos. Sugira uma ação concreta. (3-4 linhas)`,
      metadata       : { descricao: conta.descricao, valor: conta.valor, vencimento: conta.data, envelope: env.nome, disponivel: env.disponivel, deficit },
    })
    break // Máximo 1 conta por disparo (a mais urgente)
  }

  return triggers
}

// ----------------------------------------------------------------------------

async function evaluateMetaAtingida(
  supabase: SupabaseAdmin,
  userId: string,
  familyId: string,
  mesRef: string
): Promise<FiredTrigger[]> {
  const { data: caixinhas } = await supabase
    .from('caixinhas')
    .select('id, nome, meta, saldo_atual')
    .eq('family_id', familyId)
    .not('meta', 'is', null)

  if (!caixinhas?.length) return []

  const triggers: FiredTrigger[] = []
  for (const cx of caixinhas) {
    if (!cx.meta || (cx.saldo_atual ?? 0) < cx.meta) continue

    const triggerKey = `${T.META_ATINGIDA}_${cx.id}`

    // Dispara apenas uma vez por mês por caixinha
    const mesInicioTimestamp = new Date(`${mesRef}-01T00:00:00Z`).toISOString()
    const { data: logExistente } = await supabase
      .from('ai_proactive_trigger_log')
      .select('id')
      .eq('user_id', userId)
      .eq('trigger_key', triggerKey)
      .gte('triggered_at', mesInicioTimestamp)
      .limit(1)
      .maybeSingle()

    if (logExistente) continue

    const percentual = Math.round(((cx.saldo_atual ?? 0) / cx.meta) * 10000) / 100

    triggers.push({
      key            : triggerKey,
      baseKey        : T.META_ATINGIDA,
      priority       : PRIORITY[T.META_ATINGIDA],
      triggerContext : `[ANÁLISE: META DE RESERVA ATINGIDA — CELEBRAÇÃO]\n`
                     + `Caixinha: "${cx.nome}"\n`
                     + `Meta estabelecida: ${formatBRL(cx.meta)}\n`
                     + `Saldo atual: ${formatBRL(cx.saldo_atual ?? 0)} (${percentual}% da meta)\n`
                     + `\nGere uma mensagem celebrando a conquista desta meta. Use os valores exatos. Seja positivo e motivador — esta é uma vitória real do usuário. (2-3 linhas)`,
      metadata       : { nome: cx.nome, meta: cx.meta, saldo_atual: cx.saldo_atual, percentual },
    })
    break // Celebra uma caixinha por vez
  }

  return triggers
}

// ----------------------------------------------------------------------------

async function evaluateDesequilibrioCasal(
  supabase: SupabaseAdmin,
  familyId: string,
  mesRef: string
): Promise<FiredTrigger | null> {
  const mesStart = `${mesRef}-01`
  const mesEnd   = `${mesRef}-31`

  // Membros da família
  const { data: membros } = await supabase
    .from('users')
    .select('id, full_name')
    .eq('family_id', familyId)

  if (!membros || membros.length !== 2) return null  // Só avalia para casais (2 membros)

  // Gastos por usuário no mês
  const { data: lancamentos } = await supabase
    .from('lancamentos')
    .select('user_id, valor')
    .eq('family_id', familyId)
    .eq('tipo', 'despesa')
    .eq('status', 'pago')
    .gte('data', mesStart)
    .lte('data', mesEnd)
    .not('user_id', 'is', null)

  if (!lancamentos?.length) return null

  const gastosPorUser: Record<string, number> = {}
  for (const l of lancamentos) {
    if (!l.user_id) continue
    gastosPorUser[l.user_id] = (gastosPorUser[l.user_id] ?? 0) + l.valor
  }

  const userIds = Object.keys(gastosPorUser)
  if (userIds.length < 2) return null

  const [idA, idB] = userIds
  const gastoA = gastosPorUser[idA] ?? 0
  const gastoB = gastosPorUser[idB] ?? 0

  const maior = Math.max(gastoA, gastoB)
  const menor = Math.min(gastoA, gastoB)

  if (menor <= 0 || maior / menor < 2) return null

  const membroA = membros.find((m) => m.id === idA)
  const membroB = membros.find((m) => m.id === idB)
  const nomeA   = membroA?.full_name ?? 'Membro A'
  const nomeB   = membroB?.full_name ?? 'Membro B'
  const ratio   = Math.round((maior / menor) * 10) / 10

  const [nomeQuemMaisGastou, gastoQuemMais, nomeQuemMenosGastou, gastoQuemMenos] =
    gastoA >= gastoB
      ? [nomeA, gastoA, nomeB, gastoB]
      : [nomeB, gastoB, nomeA, gastoA]

  return {
    key            : T.DESEQUILIBRIO_CASAL,
    baseKey        : T.DESEQUILIBRIO_CASAL,
    priority       : PRIORITY[T.DESEQUILIBRIO_CASAL],
    triggerContext : `[ANÁLISE: DESEQUILÍBRIO DE GASTOS NO CASAL]\n`
                   + `Mês: ${mesLabel(mesRef)}\n`
                   + `${nomeQuemMaisGastou}: ${formatBRL(gastoQuemMais)} em despesas pagas\n`
                   + `${nomeQuemMenosGastou}: ${formatBRL(gastoQuemMenos)} em despesas pagas\n`
                   + `Proporção: ${ratio}x de diferença (acima do limite de 2x)\n`
                   + `\nGere uma mensagem observando esse desequilíbrio de forma respeitosa e construtiva. Use os nomes e valores exatos. Sugira uma conversa sobre divisão de despesas. (3-4 linhas)`,
    metadata       : { [nomeA]: gastoA, [nomeB]: gastoB, ratio },
  }
}

// ----------------------------------------------------------------------------

async function evaluateFechamentoTodosOk(
  supabase: SupabaseAdmin,
  userId: string,
  familyId: string,
  mesAnterior: string
): Promise<FiredTrigger | null> {
  // Só dispara uma vez por mês (busca log em janeiro se hoje for 1º de fevereiro, etc.)
  const mesAtualInicio = new Date(`${getMesAtual()}-01T00:00:00Z`).toISOString()
  const { data: logExistente } = await supabase
    .from('ai_proactive_trigger_log')
    .select('id')
    .eq('user_id', userId)
    .eq('trigger_key', T.FECHAMENTO_TODOS_OK)
    .gte('triggered_at', mesAtualInicio)
    .limit(1)
    .maybeSingle()

  if (logExistente) return null

  const mesStart = `${mesAnterior}-01`
  const mesEnd   = `${mesAnterior}-31`

  const { data: orcamento } = await supabase
    .from('orcamentos_mensais')
    .select('id')
    .eq('family_id', familyId)
    .eq('mes_referencia', mesStart)
    .maybeSingle()

  if (!orcamento) return null

  const [budgetsRes, lancamentosRes] = await Promise.all([
    supabase.from('categorias_budget').select('categoria_id, valor_orcado').eq('orcamento_id', orcamento.id),
    supabase
      .from('lancamentos')
      .select('categoria_id, valor, data, parcela_total, data_vencimento_fatura')
      .eq('family_id', familyId).eq('tipo', 'despesa').eq('status', 'pago')
      .gte('data', mesStart).lte('data', mesEnd),
  ])

  const budgets     = budgetsRes.data ?? []
  const lancamentos = lancamentosRes.data ?? []

  if (!budgets.length) return null

  const gastos: Record<string, number> = {}
  for (const l of lancamentos) {
    const mesEnv = (l.parcela_total > 1 && l.data_vencimento_fatura)
      ? l.data_vencimento_fatura.substring(0, 7)
      : l.data.substring(0, 7)
    if (mesEnv === mesAnterior) {
      gastos[l.categoria_id] = (gastos[l.categoria_id] ?? 0) + l.valor
    }
  }

  const algumEstourou = budgets.some((b) => (gastos[b.categoria_id] ?? 0) > b.valor_orcado)
  if (algumEstourou) return null

  const totalOrcado = budgets.reduce((s, b) => s + b.valor_orcado, 0)
  const totalGasto  = budgets.reduce((s, b) => s + (gastos[b.categoria_id] ?? 0), 0)
  const economia    = totalOrcado - totalGasto
  const percentEcon = Math.round((economia / totalOrcado) * 10000) / 100

  return {
    key            : T.FECHAMENTO_TODOS_OK,
    baseKey        : T.FECHAMENTO_TODOS_OK,
    priority       : PRIORITY[T.FECHAMENTO_TODOS_OK],
    triggerContext : `[ANÁLISE: FECHAMENTO PERFEITO DO MÊS — CELEBRAÇÃO]\n`
                   + `Mês encerrado: ${mesLabel(mesAnterior)}\n`
                   + `Todos os ${budgets.length} envelopes terminaram dentro do limite!\n`
                   + `Total orçado: ${formatBRL(totalOrcado)}\n`
                   + `Total gasto: ${formatBRL(totalGasto)}\n`
                   + `Economia total: ${formatBRL(economia)} (${percentEcon}% do orçamento guardado)\n`
                   + `\nGere uma mensagem celebrando este feito com entusiasmo genuíno. Use os números exatos. É uma conquista real — comemore! (2-3 linhas)`,
    metadata       : { mes: mesAnterior, total_orcado: totalOrcado, total_gasto: totalGasto, economia },
  }
}

// ----------------------------------------------------------------------------

async function evaluateResumoMensal(
  supabase: SupabaseAdmin,
  userId: string,
  familyId: string,
  mesAnterior: string
): Promise<FiredTrigger | null> {
  // Só dispara uma vez por mês
  const mesAtualInicio = new Date(`${getMesAtual()}-01T00:00:00Z`).toISOString()
  const { data: logExistente } = await supabase
    .from('ai_proactive_trigger_log')
    .select('id')
    .eq('user_id', userId)
    .eq('trigger_key', T.RESUMO_MENSAL)
    .gte('triggered_at', mesAtualInicio)
    .limit(1)
    .maybeSingle()

  if (logExistente) return null

  const mesDoisAtras = getMesDoisAtras()

  // Dados do mês anterior
  const { data: orcAnterior } = await supabase
    .from('orcamentos_mensais')
    .select('id')
    .eq('family_id', familyId)
    .eq('mes_referencia', `${mesAnterior}-01`)
    .maybeSingle()

  if (!orcAnterior) return null

  const [budgetsRes, categoriasRes, lancAntRes, lancAntes2Res] = await Promise.all([
    supabase.from('categorias_budget').select('categoria_id, valor_orcado').eq('orcamento_id', orcAnterior.id),
    supabase.from('categorias').select('id, nome').eq('family_id', familyId),
    supabase
      .from('lancamentos')
      .select('categoria_id, valor, status, tipo, data, parcela_total, data_vencimento_fatura')
      .eq('family_id', familyId)
      .in('status', ['pago', 'projetado'])
      .gte('data', `${mesAnterior}-01`).lte('data', `${mesAnterior}-31`),
    supabase
      .from('lancamentos')
      .select('valor, tipo, status')
      .eq('family_id', familyId)
      .eq('status', 'pago')
      .gte('data', `${mesDoisAtras}-01`).lte('data', `${mesDoisAtras}-31`),
  ])

  const budgets     = budgetsRes.data ?? []
  const categorias  = categoriasRes.data ?? []
  const lancamentos = lancAntRes.data ?? []
  const lancAntes2  = lancAntes2Res.data ?? []

  const gastos: Record<string, number> = {}
  let totalReceitas = 0
  for (const l of lancamentos) {
    if (l.tipo === 'receita' && l.status === 'pago') { totalReceitas += l.valor; continue }
    if (l.tipo !== 'despesa') continue
    const mesEnv = (l.parcela_total > 1 && l.data_vencimento_fatura)
      ? l.data_vencimento_fatura.substring(0, 7)
      : l.data.substring(0, 7)
    if (mesEnv === mesAnterior) {
      gastos[l.categoria_id] = (gastos[l.categoria_id] ?? 0) + l.valor
    }
  }

  type EnvPerf = { nome: string; valor_orcado: number; valor_gasto: number; percentual: number; estourou: boolean }
  const envsPerf: EnvPerf[] = []
  for (const b of budgets) {
    const cat     = categorias.find((c) => c.id === b.categoria_id)
    if (!cat) continue
    const gasto   = gastos[b.categoria_id] ?? 0
    const perc    = b.valor_orcado > 0 ? Math.round((gasto / b.valor_orcado) * 10000) / 100 : 0
    envsPerf.push({ nome: cat.nome, valor_orcado: b.valor_orcado, valor_gasto: gasto, percentual: perc, estourou: gasto > b.valor_orcado })
  }

  if (!envsPerf.length) return null

  envsPerf.sort((a, b) => b.percentual - a.percentual)

  const pioresEnvelopes  = envsPerf.filter((e) => e.estourou).slice(0, 2)
  const melhorEnvelope   = [...envsPerf].sort((a, b) => a.percentual - b.percentual)[0]
  const totalOrcado      = envsPerf.reduce((s, e) => s + e.valor_orcado, 0)
  const totalGasto       = envsPerf.reduce((s, e) => s + e.valor_gasto, 0)
  const totalGastoAntes2 = lancAntes2.filter((l) => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0)
  const variacaoGasto    = totalGastoAntes2 > 0
    ? Math.round(((totalGasto - totalGastoAntes2) / totalGastoAntes2) * 10000) / 100
    : 0

  const pioresStr = pioresEnvelopes.length > 0
    ? pioresEnvelopes.map((e) => `"${e.nome}" (${e.percentual}% do orçamento, déficit de ${formatBRL(e.valor_gasto - e.valor_orcado)})`).join(', ')
    : 'nenhum envelope estourou'

  return {
    key            : T.RESUMO_MENSAL,
    baseKey        : T.RESUMO_MENSAL,
    priority       : PRIORITY[T.RESUMO_MENSAL],
    triggerContext : `[ANÁLISE: RESUMO DO MÊS ENCERRADO]\n`
                   + `Mês encerrado: ${mesLabel(mesAnterior)}\n`
                   + `Receitas recebidas: ${formatBRL(totalReceitas)}\n`
                   + `Total gasto: ${formatBRL(totalGasto)}  |  Orçado: ${formatBRL(totalOrcado)}\n`
                   + `Resultado: ${totalGasto <= totalOrcado ? `Dentro do orçamento (economia de ${formatBRL(totalOrcado - totalGasto)})` : `Acima do orçamento (estouro de ${formatBRL(totalGasto - totalOrcado)})`}\n`
                   + `Comparativo com ${mesLabel(mesDoisAtras)}: gastos ${variacaoGasto >= 0 ? '+' : ''}${variacaoGasto}%\n`
                   + `Envelopes que mais estouraram: ${pioresStr}\n`
                   + `Melhor envelope: "${melhorEnvelope.nome}" (${melhorEnvelope.percentual}% do orçamento usado)\n`
                   + `\nGere um resumo mensal natural e perspicaz. Destaque o mais importante, compare com o mês anterior e dê uma perspectiva para o próximo mês. Use os dados exatos. (4-5 linhas)`,
    metadata       : { mes: mesAnterior, total_orcado: totalOrcado, total_gasto: totalGasto, variacao_pct: variacaoGasto },
  }
}

// ============================================================================
// VERIFICADOR DE COOLDOWN POR GATILHO (7 dias)
// ============================================================================

async function passaCooldown7Dias(
  supabase: SupabaseAdmin,
  userId: string,
  triggerKey: string
): Promise<boolean> {
  const limite = new Date()
  limite.setDate(limite.getDate() - COOLDOWN_DAYS)

  const { data } = await supabase
    .from('ai_proactive_trigger_log')
    .select('id')
    .eq('user_id', userId)
    .eq('trigger_key', triggerKey)
    .gte('triggered_at', limite.toISOString())
    // Exclui entradas marcadas como primeira ocorrência (não contam como disparo real)
    .or('metadata->primeira_ocorrencia.is.null,metadata->primeira_ocorrencia.eq.false')
    .limit(1)
    .maybeSingle()

  return !data  // Se não há log recente, passa o cooldown
}

// ============================================================================
// GERADOR DE MENSAGEM GPT
// ============================================================================

async function generateMessage(
  openaiKey: string,
  tone: string,
  financialContext: string,
  triggerContext: string
): Promise<string> {
  const systemPrompt = PERSONALITY_PROMPTS[tone] ?? PERSONALITY_PROMPTS['parceiro']

  const userMessage = `Contexto financeiro atual do usuário:\n${financialContext}\n\n---\n\n${triggerContext}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body    : JSON.stringify({
      model      : OPENAI_MODEL,
      messages   : [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage },
      ],
      max_tokens  : MAX_TOKENS,
      temperature : 0.7,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ============================================================================
// PROCESSAMENTO POR USUÁRIO
// ============================================================================

async function processUser(
  supabase   : SupabaseAdmin,
  userId     : string,
  openaiKey  : string,
  isFirstOfMonth: boolean
): Promise<{ skipped?: string; triggered?: string; message_id?: string }> {

  // 1. family_id
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', userId)
    .maybeSingle()

  const familyId = userData?.family_id
  if (!familyId) return { skipped: 'sem family_id' }

  // 2. Permissão específica 'assistente'
  const { data: accessData } = await supabase
    .from('ai_feature_access')
    .select('id')
    .eq('user_id', userId)
    .eq('enabled', true)
    .maybeSingle()

  if (!accessData) return { skipped: 'sem master access' }

  const { data: permData } = await supabase
    .from('ai_feature_permissions')
    .select('enabled')
    .eq('access_id', accessData.id)
    .eq('feature_key', 'assistente')
    .maybeSingle()

  if (!permData?.enabled) return { skipped: 'permissão assistente desabilitada' }

  // 3. Créditos proativos disponíveis
  const mesAtual = getMesAtual()

  const { data: creditsConfig } = await supabase
    .from('ai_credits_config')
    .select('creditos_proativas')
    .eq('user_id', userId)
    .maybeSingle()

  const creditosProativas = creditsConfig?.creditos_proativas ?? 10

  const { count: usadoProativas } = await supabase
    .from('ai_usage_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('feature_type', 'proativa')
    .eq('mes_referencia', mesAtual)

  if ((usadoProativas ?? 0) >= creditosProativas) {
    return { skipped: `sem créditos proativos (${usadoProativas}/${creditosProativas})` }
  }

  // 4. Cooldown 24h global (máx 1 proativa por dia por família)
  const h24Atras = new Date()
  h24Atras.setHours(h24Atras.getHours() - 24)

  const { count: msgRecentes } = await supabase
    .from('assistente_mensagens')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('message_type', 'proactive')
    .gte('created_at', h24Atras.toISOString())

  if ((msgRecentes ?? 0) > 0) return { skipped: 'cooldown 24h' }

  // 5. Tom de personalidade
  const { data: prefData } = await supabase
    .from('user_ai_preferences')
    .select('personality_tone')
    .eq('user_id', userId)
    .maybeSingle()

  const tone = prefData?.personality_tone ?? 'parceiro'

  // 6. Contexto financeiro (uma única vez por usuário)
  const mesAnterior      = getMesAnterior()
  const financialContext = await buildFinancialContext(supabase, familyId, mesAtual)

  // 7. Avaliar gatilhos
  const candidatos: FiredTrigger[] = []

  // Gatilhos de fechamento de mês (apenas no dia 1)
  if (isFirstOfMonth) {
    const [fechamento, resumo] = await Promise.all([
      evaluateFechamentoTodosOk(supabase, userId, familyId, mesAnterior),
      evaluateResumoMensal(supabase, userId, familyId, mesAnterior),
    ])
    if (fechamento) candidatos.push(fechamento)
    if (resumo)     candidatos.push(resumo)
  }

  // Gatilhos diários
  const [envelopes, lancamentos, contasSemCobertura, metasAtingidas, desequilibrio] = await Promise.all([
    evaluateEnvelopeEstourado2x(supabase, userId, familyId, mesAtual),
    evaluateSemLancamentos7Dias(supabase, familyId),
    evaluateContaSemCobertura(supabase, familyId, mesAtual),
    evaluateMetaAtingida(supabase, userId, familyId, mesAtual),
    evaluateDesequilibrioCasal(supabase, familyId, mesAtual),
  ])

  candidatos.push(...envelopes, ...contasSemCobertura, ...metasAtingidas)
  if (lancamentos)  candidatos.push(lancamentos)
  if (desequilibrio) candidatos.push(desequilibrio)

  if (!candidatos.length) return { skipped: 'nenhum gatilho ativado' }

  // 8. Ordenar por prioridade e verificar cooldown de 7 dias
  candidatos.sort((a, b) => a.priority - b.priority)

  let escolhido: FiredTrigger | null = null
  for (const c of candidatos) {
    const passa = await passaCooldown7Dias(supabase, userId, c.key)
    if (passa) { escolhido = c; break }
  }

  if (!escolhido) return { skipped: 'todos os gatilhos em cooldown de 7 dias' }

  console.log(`[ai-proativo] user=${userId} trigger=${escolhido.key}`)

  // 9. Gerar mensagem com GPT
  const conteudo = await generateMessage(openaiKey, tone, financialContext, escolhido.triggerContext)
  if (!conteudo) throw new Error('GPT retornou resposta vazia')

  // 10. Persistir: mensagem + trigger_log + usage_log (em paralelo)
  const { data: msgInserida } = await supabase
    .from('assistente_mensagens')
    .insert({
      family_id   : familyId,
      user_id     : userId,
      role        : 'assistant',
      conteudo,
      tone,
      message_type: 'proactive',
      is_read     : false,
      trigger_key : escolhido.baseKey,
    })
    .select('id')
    .single()

  const messageId = msgInserida?.id ?? null

  await Promise.all([
    supabase.from('ai_proactive_trigger_log').insert({
      user_id    : userId,
      family_id  : familyId,
      trigger_key: escolhido.key,
      message_id : messageId,
      metadata   : escolhido.metadata,
    }),
    supabase.from('ai_usage_log').insert({
      user_id       : userId,
      mes_referencia: mesAtual,
      feature_type  : 'proativa',
    }),
  ])

  // 11. Enviar push notification (best-effort — não bloqueia nem falha o fluxo)
  try {
    const { data: prefData } = await supabase
      .from('push_notification_preferences')
      .select('ai_proactive')
      .eq('user_id', userId)
      .maybeSingle()

    const wantsPush = prefData?.ai_proactive !== false // default true

    if (wantsPush) {
      const { data: subscriptions } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .limit(1)

      if (subscriptions?.length) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        // Truncate message body to fit push notification (~100 chars)
        const bodyPreview = conteudo.replace(/\n/g, ' ').substring(0, 100) + (conteudo.length > 100 ? '…' : '')

        await fetch(`${supabaseUrl}/functions/v1/send-push`, {
          method  : 'POST',
          headers : {
            'Content-Type'  : 'application/json',
            'Authorization' : `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            userId,
            payload: {
              title : '💡 PocketWise tem um alerta para você',
              body  : bodyPreview,
              url   : '/app/assistente',
              tag   : `ai_proactive_${escolhido.baseKey}`,
              urgent: ALERT_TRIGGERS.has(escolhido.baseKey),
            },
            notificationType: 'ai_proactive',
            refKey          : escolhido.baseKey,
          }),
        })
      }
    }
  } catch (pushErr) {
    // Push failure never breaks the main proactive flow
    console.warn(`[ai-proativo] push opcional falhou user=${userId}:`, pushErr)
  }

  return { triggered: escolhido.key, message_id: messageId }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  // Autenticação por CRON_SECRET (chamada feita pelo pg_cron via pg_net)
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY não configurada' }), { status: 500 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const today         = new Date()
  const isFirstOfMonth = today.getDate() === 1

  console.log(`[ai-proativo] iniciando — ${today.toISOString()} | dia_1=${isFirstOfMonth}`)

  // Buscar todos os usuários habilitados na IA com user_id vinculado
  const { data: accessList, error: accessErr } = await supabase
    .from('ai_feature_access')
    .select('user_id')
    .eq('enabled', true)
    .not('user_id', 'is', null)

  if (accessErr) {
    console.error('[ai-proativo] erro ao buscar usuários:', accessErr)
    return new Response(JSON.stringify({ error: accessErr.message }), { status: 500 })
  }

  const usuarios = accessList ?? []
  console.log(`[ai-proativo] ${usuarios.length} usuário(s) a processar`)

  const resultados: Array<{ user_id: string } & Record<string, unknown>> = []

  for (const { user_id } of usuarios) {
    if (!user_id) continue
    try {
      const resultado = await processUser(supabase, user_id, openaiKey, isFirstOfMonth)
      console.log(`[ai-proativo] user=${user_id}`, JSON.stringify(resultado))
      resultados.push({ user_id, ...resultado })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[ai-proativo] ERRO user=${user_id}:`, msg)
      resultados.push({ user_id, error: msg })
    }
  }

  const disparados = resultados.filter((r) => 'triggered' in r).length
  const pulados    = resultados.filter((r) => 'skipped'   in r).length
  const erros      = resultados.filter((r) => 'error'     in r).length

  console.log(`[ai-proativo] concluído — disparados=${disparados} pulados=${pulados} erros=${erros}`)

  return new Response(
    JSON.stringify({ ok: true, processados: usuarios.length, disparados, pulados, erros, resultados }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
