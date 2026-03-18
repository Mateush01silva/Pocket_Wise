import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// notify-daily-push — Daily cron for financial + trial push notifications
//
// Runs daily at ~8h BRT via pg_cron.
// Checks all users with active push subscriptions and sends relevant alerts:
//
//   1. Envelope estourado       (cooldown: 24h per envelope)
//   2. Despesas vencidas        (cooldown: 24h global, consolidated)
//   3. Cartão no limite (≥90%)  (cooldown: 24h per card)
//   4. Trial expirando em 3d    (once per trial)
//   5. Trial expirando em 1d    (once per trial)
//   6. Trial expirado recente   (once per trial, within 2 days after expiry)
//
// Respects `push_notification_preferences` opt-in per user.
// ============================================================================

type SupabaseAdmin = ReturnType<typeof createClient>

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getMesAtual(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function hasCooldown(
  supabase: SupabaseAdmin,
  userId: string,
  notificationType: string,
  refKey: string | null,
  cooldownHours: number
): Promise<boolean> {
  const since = new Date()
  since.setHours(since.getHours() - cooldownHours)

  let query = supabase
    .from('push_notification_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('notification_type', notificationType)
    .gte('sent_at', since.toISOString())

  if (refKey !== null) {
    query = query.eq('ref_key', refKey)
  }

  const { count } = await query
  return (count ?? 0) > 0
}

async function sendPush(
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  payload: Record<string, unknown>,
  notificationType: string,
  refKey?: string
): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method  : 'POST',
      headers : {
        'Content-Type'  : 'application/json',
        'Authorization' : `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ userId, payload, notificationType, refKey }),
    })
  } catch (err) {
    console.error(`[notify-daily-push] sendPush error user=${userId}:`, err)
  }
}

// ----------------------------------------------------------------------------
// 1. Envelope burst alerts
// ----------------------------------------------------------------------------

async function checkEnvelopes(
  supabase: SupabaseAdmin,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  familyId: string,
  prefs: Record<string, boolean>
): Promise<void> {
  if (!prefs.envelope_burst) return

  const mesAtual = getMesAtual()
  const mesStart = `${mesAtual}-01`
  const mesEnd   = `${mesAtual}-31`

  const { data: orcamento } = await supabase
    .from('orcamentos_mensais')
    .select('id')
    .eq('family_id', familyId)
    .eq('mes_referencia', mesStart)
    .maybeSingle()

  if (!orcamento) return

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
    if (mesEnv === mesAtual) {
      gastos[l.categoria_id] = (gastos[l.categoria_id] ?? 0) + l.valor
    }
  }

  const estourados: Array<{ nome: string; catId: string; percentual: number; deficit: number }> = []
  for (const b of budgets) {
    const gasto = gastos[b.categoria_id] ?? 0
    if (gasto <= b.valor_orcado) continue
    const cat = categorias.find((c) => c.id === b.categoria_id)
    if (!cat) continue
    estourados.push({
      nome      : cat.nome,
      catId     : b.categoria_id as string,
      percentual: Math.round((gasto / b.valor_orcado) * 100),
      deficit   : Math.round((gasto - b.valor_orcado) * 100) / 100,
    })
  }

  if (!estourados.length) return

  for (const env of estourados.slice(0, 2)) {
    const onCooldown = await hasCooldown(supabase, userId, 'envelope_burst', env.catId, 24)
    if (onCooldown) continue

    await sendPush(supabaseUrl, serviceKey, userId, {
      title  : '🔴 Envelope estourado',
      body   : `${env.nome} ultrapassou ${env.percentual}% do orçamento. Déficit: ${formatBRL(env.deficit)}`,
      url    : '/app/envelopes',
      tag    : `envelope_burst_${env.catId}`,
      urgent : true,
    }, 'envelope_burst', env.catId)
  }
}

// ----------------------------------------------------------------------------
// 2. Overdue expenses
// ----------------------------------------------------------------------------

async function checkExpensesOverdue(
  supabase: SupabaseAdmin,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  familyId: string,
  prefs: Record<string, boolean>
): Promise<void> {
  if (!prefs.expense_overdue) return

  const onCooldown = await hasCooldown(supabase, userId, 'expense_overdue', null, 24)
  if (onCooldown) return

  const today = new Date().toISOString().substring(0, 10)

  const { data: vencidas, count } = await supabase
    .from('lancamentos')
    .select('valor', { count: 'exact' })
    .eq('family_id', familyId)
    .eq('tipo', 'despesa')
    .eq('status', 'pendente')
    .neq('forma_pagamento', 'credito')
    .lt('data', today)

  if (!count || count === 0) return

  const total = (vencidas ?? []).reduce((s, l) => s + (l.valor as number), 0)

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '⏰ Despesas vencidas',
    body   : `${count} despesa${count > 1 ? 's' : ''} vencida${count > 1 ? 's' : ''} — total ${formatBRL(total)}`,
    url    : '/app/transacoes?status=pendente&periodo=todos',
    tag    : 'expense_overdue',
    urgent : true,
  }, 'expense_overdue')
}

// ----------------------------------------------------------------------------
// 3. Credit card near limit
// ----------------------------------------------------------------------------

async function checkCreditCards(
  supabase: SupabaseAdmin,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  familyId: string,
  prefs: Record<string, boolean>
): Promise<void> {
  if (!prefs.credit_card_limit) return

  const mesAtual = getMesAtual()
  const mesStart = `${mesAtual}-01`
  const mesEnd   = `${mesAtual}-31`

  const { data: cartoes } = await supabase
    .from('cartoes')
    .select('id, nome, limite')
    .eq('family_id', familyId)
    .eq('ativo', true)

  if (!cartoes?.length) return

  for (const cartao of cartoes) {
    if (!cartao.limite) continue

    const { data: lancamentos } = await supabase
      .from('lancamentos')
      .select('valor')
      .eq('family_id', familyId)
      .eq('cartao_id', cartao.id)
      .eq('tipo', 'despesa')
      .in('status', ['pago', 'projetado'])
      .gte('data_vencimento_fatura', mesStart)
      .lte('data_vencimento_fatura', mesEnd)

    const total = (lancamentos ?? []).reduce((s, l) => s + (l.valor as number), 0)
    const percentual = Math.round((total / (cartao.limite as number)) * 100)

    if (percentual < 90) continue

    const onCooldown = await hasCooldown(supabase, userId, 'credit_card_limit', cartao.id as string, 24)
    if (onCooldown) continue

    const isExceeded = percentual >= 100
    await sendPush(supabaseUrl, serviceKey, userId, {
      title  : isExceeded ? '🚨 Limite do cartão excedido' : '⚠️ Limite do cartão quase esgotado',
      body   : `${cartao.nome as string}: ${percentual}% do limite usado (${formatBRL(total)} de ${formatBRL(cartao.limite as number)})`,
      url    : '/app/cartoes',
      tag    : `credit_card_${cartao.id as string}`,
      urgent : isExceeded,
    }, 'credit_card_limit', cartao.id as string)
  }
}

// ----------------------------------------------------------------------------
// 4-6. Trial notifications
// ----------------------------------------------------------------------------

async function checkTrial(
  supabase: SupabaseAdmin,
  supabaseUrl: string,
  serviceKey: string,
  userId: string,
  prefs: Record<string, boolean>
): Promise<void> {
  if (!prefs.trial_expiring) return

  const { data: plano } = await supabase
    .from('plano_usuario')
    .select('status, trial_ends_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (!plano) return

  const now = new Date()

  if (plano.status === 'trial' && plano.trial_ends_at) {
    const trialEnd  = new Date(plano.trial_ends_at as string)
    const diffMs    = trialEnd.getTime() - now.getTime()
    const diffDays  = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 3) {
      const onCooldown = await hasCooldown(supabase, userId, 'trial_3d', 'trial', 23)
      if (!onCooldown) {
        await sendPush(supabaseUrl, serviceKey, userId, {
          title  : '⏳ Seu trial acaba em 3 dias',
          body   : 'Continue controlando suas finanças sem interrupção. Assine agora!',
          url    : '/app/paywall',
          tag    : 'trial_expiring',
          urgent : false,
        }, 'trial_3d', 'trial')
      }
    }

    if (diffDays === 1) {
      const onCooldown = await hasCooldown(supabase, userId, 'trial_1d', 'trial', 23)
      if (!onCooldown) {
        await sendPush(supabaseUrl, serviceKey, userId, {
          title  : '⚠️ Último dia de trial',
          body   : 'Seu período gratuito termina hoje. Assine e continue sem perder nada.',
          url    : '/app/paywall',
          tag    : 'trial_expiring',
          urgent : true,
        }, 'trial_1d', 'trial')
      }
    }
  }

  // Reengajamento: trial expirou há 1-2 dias
  if (plano.status === 'expired' && plano.trial_ends_at) {
    const trialEnd  = new Date(plano.trial_ends_at as string)
    const diffMs    = now.getTime() - trialEnd.getTime()
    const diffDays  = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays >= 1 && diffDays <= 2) {
      const onCooldown = await hasCooldown(supabase, userId, 'trial_expired_reengagement', 'trial', 23)
      if (!onCooldown) {
        await sendPush(supabaseUrl, serviceKey, userId, {
          title  : '💙 Sentimos sua falta no Pocket Wise',
          body   : 'Seu trial acabou, mas seus dados estão salvos. Assine e volte a controlar suas finanças.',
          url    : '/app/paywall',
          tag    : 'trial_reengagement',
          urgent : false,
        }, 'trial_expired_reengagement', 'trial')
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Process a single user
// ----------------------------------------------------------------------------

async function processUser(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string
): Promise<{ skipped?: string; processed?: boolean }> {
  // Get family
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', userId)
    .maybeSingle()

  const familyId = userData?.family_id as string | undefined
  if (!familyId) return { skipped: 'sem family_id' }

  // Load preferences (defaults to all true if no row)
  const { data: prefsRow } = await supabase
    .from('push_notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  const prefs: Record<string, boolean> = {
    envelope_burst    : prefsRow?.envelope_burst    ?? true,
    expense_overdue   : prefsRow?.expense_overdue   ?? true,
    credit_card_limit : prefsRow?.credit_card_limit ?? true,
    trial_expiring    : prefsRow?.trial_expiring    ?? true,
  }

  // Run all checks in parallel (independent — safe to do so)
  await Promise.allSettled([
    checkEnvelopes(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
    checkExpensesOverdue(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
    checkCreditCards(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
    checkTrial(supabase, supabaseUrl, serviceKey, userId, prefs),
  ])

  return { processed: true }
}

// ----------------------------------------------------------------------------
// Main handler
// ----------------------------------------------------------------------------

serve(async (req) => {
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  const supabase = createClient(supabaseUrl, serviceKey)

  console.log(`[notify-daily-push] iniciando — ${new Date().toISOString()}`)

  // Fetch all users with at least one active push subscription
  const { data: rows, error } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('is_active', true)

  if (error) {
    console.error('[notify-daily-push] erro ao buscar subscriptions:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // Deduplicate user IDs
  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))]
  console.log(`[notify-daily-push] ${userIds.length} usuário(s) com subscription ativa`)

  const resultados: Array<{ user_id: string } & Record<string, unknown>> = []

  for (const userId of userIds) {
    try {
      const result = await processUser(supabase, supabaseUrl, serviceKey, userId)
      resultados.push({ user_id: userId, ...result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[notify-daily-push] ERRO user=${userId}:`, msg)
      resultados.push({ user_id: userId, error: msg })
    }
  }

  const processados = resultados.filter((r) => r.processed).length
  const pulados     = resultados.filter((r) => r.skipped).length
  const erros       = resultados.filter((r) => r.error).length

  console.log(`[notify-daily-push] concluído — processados=${processados} pulados=${pulados} erros=${erros}`)

  return new Response(
    JSON.stringify({ ok: true, total: userIds.length, processados, pulados, erros }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
