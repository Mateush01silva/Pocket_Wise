import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// notify-daily-push — Cron for financial + trial push notifications
//
// Runs in two windows via pg_cron:
//   - morning (08:00 BRT / 11:00 UTC): alertas financeiros (13 checks)
//   - evening (20:00 BRT / 23:00 UTC): engajamento diário  (3 checks)
//
// The window is selected via the `window` field in the request body.
// Defaults to 'morning' when omitted (backward-compatible).
//
// MORNING checks:
//   1. Envelope estourado          (cooldown: 24h per envelope)
//   2. Despesas vencidas           (cooldown: 24h global, consolidated)
//   3. Cartão no limite (≥90%)     (cooldown: 24h per card)
//   4. Trial expirando em 3d       (once per trial)
//   5. Trial expirando em 1d       (once per trial)
//   6. Trial expirado recente      (once per trial, within 2 days after expiry)
//   7. Fim de mês em 3 dias        (once per month)
//   8. Milestone de caixinha       (once per milestone, 30-day cooldown)
//   9. Fatura vencendo em 3 dias   (cooldown: 23h per card)
//  10. Gasto incomum               (cooldown: 7 days per category)
//  11. 7 dias sem lançamento       (cooldown: 7 days, non-AI users only)
//  12. Check-in do novo mês        (once per month, day 1, non-AI users only)
//  13. Mês perfeito                (once per month, day 1, non-AI users only)
//
// EVENING checks:
//  14. Sem lançamentos hoje        (cooldown: 24h, opt-in)
//  15. Resumo semanal              (toda segunda-feira, cooldown: 7 days)
//  16. Orçamento do fim de semana  (toda sexta-feira, cooldown: 7 days)
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
    const internalSecret = Deno.env.get('CRON_SECRET') ?? ''
    const res = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method  : 'POST',
      headers : {
        'Content-Type'     : 'application/json',
        'x-internal-secret': internalSecret,
      },
      body: JSON.stringify({ userId, payload, notificationType, refKey }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[notify-daily-push] sendPush HTTP ${res.status} user=${userId}: ${text}`)
    }
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
    const gasto   = gastos[b.categoria_id] ?? 0
    const deficit = Math.round((gasto - b.valor_orcado) * 100) / 100
    if (deficit <= 0) continue   // ignora empate exato e artefatos de float
    const cat = categorias.find((c) => c.id === b.categoria_id)
    if (!cat) continue
    estourados.push({
      nome      : cat.nome,
      catId     : b.categoria_id as string,
      percentual: Math.round((gasto / b.valor_orcado) * 100),
      deficit,
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
// 7. Month-end planning reminder (3 days before end of month)
// ----------------------------------------------------------------------------

async function checkMonthEnd(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.month_end_reminder) return

  const now      = new Date()
  const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = lastDay - now.getDate()

  if (daysLeft !== 3) return

  const onCooldown = await hasCooldown(supabase, userId, 'month_end_reminder', null, 23)
  if (onCooldown) return

  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long' })

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '📅 Faltam 3 dias para o fim do mês',
    body   : `Hora de planejar o orçamento de ${nextMonth}. Quanto você vai guardar?`,
    url    : '/app/orcamento',
    tag    : 'month_end_reminder',
    urgent : false,
  }, 'month_end_reminder')
}

// ----------------------------------------------------------------------------
// 8. Savings goal milestone (meta de caixinha atingida)
// Fires when a caixinha reaches 50%, 75% or 100% of its meta — once per milestone.
// ----------------------------------------------------------------------------

async function checkSavingsGoals(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.savings_goals) return

  const { data: caixinhas } = await supabase
    .from('caixinhas')
    .select('id, nome, meta_valor, saldo_atual')
    .eq('family_id', familyId)
    .not('meta_valor', 'is', null)

  if (!caixinhas?.length) return

  const MILESTONES = [100, 75, 50]

  for (const cx of caixinhas) {
    if (!cx.meta_valor || !cx.saldo_atual) continue

    const percentual = Math.floor(((cx.saldo_atual as number) / (cx.meta_valor as number)) * 100)

    for (const milestone of MILESTONES) {
      if (percentual < milestone) continue

      const refKey     = `${cx.id as string}_${milestone}`
      const onCooldown = await hasCooldown(supabase, userId, 'savings_goal_milestone', refKey, 24 * 30) // 30 days — once per milestone
      if (onCooldown) continue

      const isComplete = milestone === 100
      await sendPush(supabaseUrl, serviceKey, userId, {
        title  : isComplete ? '🎉 Meta atingida!' : `🎯 ${milestone}% da meta alcançado`,
        body   : isComplete
          ? `Sua caixinha "${cx.nome as string}" chegou ao objetivo de ${formatBRL(cx.meta_valor as number)}!`
          : `Sua caixinha "${cx.nome as string}" está em ${percentual}% da meta (${formatBRL(cx.saldo_atual as number)} de ${formatBRL(cx.meta_valor as number)})`,
        url    : '/app/caixinhas',
        tag    : `savings_goal_${cx.id as string}`,
        urgent : false,
      }, 'savings_goal_milestone', refKey)
      break // one milestone notification per caixinha per run
    }
  }
}

// ----------------------------------------------------------------------------
// Helper: check if user has AI feature access
// ----------------------------------------------------------------------------

async function hasAiAccess(supabase: SupabaseAdmin, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('ai_feature_access')
    .select('id')
    .eq('user_id', userId)
    .eq('enabled', true)
    .maybeSingle()
  return !!data
}

// ----------------------------------------------------------------------------
// 9. Credit card due date — 3 days before fatura is due
// ----------------------------------------------------------------------------

async function checkCreditCardDueDate(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.credit_card_due_date) return

  const { data: cartoes } = await supabase
    .from('cartoes')
    .select('id, nome, dia_vencimento')
    .eq('family_id', familyId)
    .eq('ativo', true)

  if (!cartoes?.length) return

  const now = new Date()

  for (const cartao of cartoes) {
    if (!cartao.dia_vencimento) continue

    // Find the next upcoming due date
    const tentativa = new Date(now.getFullYear(), now.getMonth(), cartao.dia_vencimento as number)
    const dueDate   = tentativa.getTime() <= now.getTime()
      ? new Date(now.getFullYear(), now.getMonth() + 1, cartao.dia_vencimento as number)
      : tentativa

    const daysUntilDue = Math.round((dueDate.getTime() - now.getTime()) / 86400000)
    if (daysUntilDue !== 3) continue

    const onCooldown = await hasCooldown(supabase, userId, 'credit_card_due_date', cartao.id as string, 23)
    if (onCooldown) continue

    // Sum fatura for the month of the due date
    const faturaMonth = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`
    const { data: lancamentos } = await supabase
      .from('lancamentos')
      .select('valor')
      .eq('family_id', familyId)
      .eq('cartao_id', cartao.id)
      .eq('tipo', 'despesa')
      .in('status', ['pago', 'projetado'])
      .gte('data_vencimento_fatura', `${faturaMonth}-01`)
      .lte('data_vencimento_fatura', `${faturaMonth}-31`)

    const total = (lancamentos ?? []).reduce((s, l) => s + (l.valor as number), 0)
    if (total <= 0) continue

    await sendPush(supabaseUrl, serviceKey, userId, {
      title  : '💳 Fatura vence em 3 dias',
      body   : `Fatura do ${cartao.nome as string} vence em 3 dias: ${formatBRL(total)}`,
      url    : '/app/cartoes',
      tag    : `credit_card_due_${cartao.id as string}`,
      urgent : false,
    }, 'credit_card_due_date', cartao.id as string)
  }
}

// ----------------------------------------------------------------------------
// 10. Unusual spending — yesterday's transactions > 2× category monthly average
// ----------------------------------------------------------------------------

async function checkUnusualSpending(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.unusual_spending) return

  // Yesterday's paid expenses
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const ontem = yesterday.toISOString().substring(0, 10)

  const { data: recentTxs } = await supabase
    .from('lancamentos')
    .select('id, categoria_id, valor, data, parcela_total, data_vencimento_fatura')
    .eq('family_id', familyId)
    .eq('tipo', 'despesa')
    .eq('status', 'pago')
    .eq('data', ontem)

  if (!recentTxs?.length) return

  // Build 3-month history per category
  const now        = new Date()
  const tresMeses  = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().substring(0, 10)
  const mesAtual   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const { data: historico } = await supabase
    .from('lancamentos')
    .select('categoria_id, valor, data, parcela_total, data_vencimento_fatura')
    .eq('family_id', familyId)
    .eq('tipo', 'despesa')
    .in('status', ['pago', 'projetado'])
    .gte('data', tresMeses)

  if (!historico?.length) return

  // Sum per category per month
  const gastosMensais: Record<string, Record<string, number>> = {}
  for (const l of historico) {
    if (!l.categoria_id) continue
    const mesEnv = (l.parcela_total > 1 && l.data_vencimento_fatura)
      ? (l.data_vencimento_fatura as string).substring(0, 7)
      : (l.data as string).substring(0, 7)
    if (mesEnv === mesAtual) continue // exclude current month from baseline
    if (!gastosMensais[l.categoria_id]) gastosMensais[l.categoria_id] = {}
    gastosMensais[l.categoria_id][mesEnv] = (gastosMensais[l.categoria_id][mesEnv] ?? 0) + (l.valor as number)
  }

  // Find category names
  const catIds = [...new Set(recentTxs.map(t => t.categoria_id).filter(Boolean))]
  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nome')
    .in('id', catIds as string[])

  const catMap: Record<string, string> = {}
  for (const c of categorias ?? []) catMap[c.id as string] = c.nome as string

  // Detect anomalies
  type Anomaly = { catName: string; valor: number; media: number; catId: string }
  const anomalias: Anomaly[] = []

  for (const tx of recentTxs) {
    if (!tx.categoria_id) continue
    const monthly = gastosMensais[tx.categoria_id as string] ?? {}
    const meses   = Object.values(monthly)
    if (meses.length < 2) continue // need at least 2 months of history

    const media = meses.reduce((s, v) => s + v, 0) / meses.length
    if (media <= 0) continue
    if ((tx.valor as number) > 2 * media) {
      anomalias.push({
        catName: catMap[tx.categoria_id as string] ?? 'categoria',
        valor  : tx.valor as number,
        media,
        catId  : tx.categoria_id as string,
      })
    }
  }

  if (!anomalias.length) return

  // Send at most 1 push (the most anomalous)
  anomalias.sort((a, b) => (b.valor / b.media) - (a.valor / a.media))
  const top = anomalias[0]

  const onCooldown = await hasCooldown(supabase, userId, 'unusual_spending', top.catId, 24 * 7)
  if (onCooldown) return

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '⚠️ Gasto fora do padrão detectado',
    body   : `${formatBRL(top.valor)} em ${top.catName} (sua média é ${formatBRL(Math.round(top.media))}/mês)`,
    url    : '/app/transacoes',
    tag    : `unusual_spending_${top.catId}`,
    urgent : false,
  }, 'unusual_spending', top.catId)
}

// ----------------------------------------------------------------------------
// 11. 7 days without transactions (non-AI users only)
// ----------------------------------------------------------------------------

async function checkSemLancamentos(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.no_transactions_reminder) return

  // Skip users with AI access — ai-proativo-diario handles them
  if (await hasAiAccess(supabase, userId)) return

  const onCooldown = await hasCooldown(supabase, userId, 'no_transactions_reminder', null, 24 * 7)
  if (onCooldown) return

  const seteAtras   = new Date()
  seteAtras.setDate(seteAtras.getDate() - 7)
  const dataLimite  = seteAtras.toISOString().substring(0, 10)

  const { count } = await supabase
    .from('lancamentos')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .gte('data', dataLimite)

  if ((count ?? 0) > 0) return

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '📋 Há 7 dias sem lançamentos',
    body   : 'Você está há 7 dias sem registrar. Tudo bem com suas finanças?',
    url    : '/app/transacoes',
    tag    : 'no_transactions_reminder',
    urgent : false,
  }, 'no_transactions_reminder')
}

// ----------------------------------------------------------------------------
// 12. Month-start check-in (non-AI users only, day 1)
// ----------------------------------------------------------------------------

async function checkMonthStart(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.month_start_checkin) return
  if (new Date().getDate() !== 1) return

  // Skip users with AI access — ai-proativo handles resumo_mensal
  if (await hasAiAccess(supabase, userId)) return

  const onCooldown = await hasCooldown(supabase, userId, 'month_start_checkin', null, 23)
  if (onCooldown) return

  const mesNome = new Date().toLocaleDateString('pt-BR', { month: 'long' })

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : `📅 Bem-vindo a ${mesNome}!`,
    body   : 'Novo mês, novo orçamento. Que tal planejar agora quanto vai guardar?',
    url    : '/app/orcamento',
    tag    : 'month_start_checkin',
    urgent : false,
  }, 'month_start_checkin')
}

// ----------------------------------------------------------------------------
// 13. Perfect month — all envelopes within budget (non-AI users only, day 1)
// ----------------------------------------------------------------------------

async function checkPerfectMonth(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.perfect_month) return
  if (new Date().getDate() !== 1) return

  // Skip users with AI access — they get fechamento_todos_envelopes_ok via IA
  if (await hasAiAccess(supabase, userId)) return

  const onCooldown = await hasCooldown(supabase, userId, 'perfect_month', null, 23)
  if (onCooldown) return

  // Check previous month
  const now      = new Date()
  const prev     = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const mesAnterior = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  const mesStart = `${mesAnterior}-01`
  const mesEnd   = `${mesAnterior}-31`

  const { data: orcamento } = await supabase
    .from('orcamentos_mensais')
    .select('id')
    .eq('family_id', familyId)
    .eq('mes_referencia', mesStart)
    .maybeSingle()

  if (!orcamento) return

  const [budgetsRes, lancamentosRes] = await Promise.all([
    supabase.from('categorias_budget').select('categoria_id, valor_orcado').eq('orcamento_id', orcamento.id),
    supabase
      .from('lancamentos')
      .select('categoria_id, valor, data, parcela_total, data_vencimento_fatura')
      .eq('family_id', familyId)
      .eq('tipo', 'despesa')
      .eq('status', 'pago')
      .gte('data', mesStart)
      .lte('data', mesEnd),
  ])

  const budgets     = budgetsRes.data ?? []
  const lancamentos = lancamentosRes.data ?? []

  if (!budgets.length) return

  const gastos: Record<string, number> = {}
  for (const l of lancamentos) {
    if (!l.categoria_id) continue
    const mesEnv = (l.parcela_total > 1 && l.data_vencimento_fatura)
      ? (l.data_vencimento_fatura as string).substring(0, 7)
      : (l.data as string).substring(0, 7)
    if (mesEnv === mesAnterior) {
      gastos[l.categoria_id as string] = (gastos[l.categoria_id as string] ?? 0) + (l.valor as number)
    }
  }

  const algumEstourou = budgets.some((b) => (gastos[b.categoria_id as string] ?? 0) > (b.valor_orcado as number))
  if (algumEstourou) return

  const totalOrcado = budgets.reduce((s, b) => s + (b.valor_orcado as number), 0)
  const totalGasto  = budgets.reduce((s, b) => s + (gastos[b.categoria_id as string] ?? 0), 0)
  const economia    = totalOrcado - totalGasto
  const mesNome     = prev.toLocaleDateString('pt-BR', { month: 'long' })

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '🏆 Mês perfeito!',
    body   : `Todos os envelopes de ${mesNome} fecharam no verde! Você economizou ${formatBRL(economia)}.`,
    url    : '/app/envelopes',
    tag    : 'perfect_month',
    urgent : false,
  }, 'perfect_month')
}

// ----------------------------------------------------------------------------
// 14. No transactions today — evening nudge (opt-in, cooldown 24h)
// ----------------------------------------------------------------------------

async function checkNoTransactionsToday(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.no_transactions_today) return

  const onCooldown = await hasCooldown(supabase, userId, 'no_transactions_today', null, 24)
  if (onCooldown) return

  const today = new Date().toISOString().substring(0, 10)

  const { count } = await supabase
    .from('lancamentos')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .eq('data', today)

  if ((count ?? 0) > 0) return

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '📝 Lembrou de registrar hoje?',
    body   : 'Nenhum lançamento por aqui. Anote seus gastos antes de dormir!',
    url    : '/app/transacoes',
    tag    : 'no_transactions_today',
    urgent : false,
  }, 'no_transactions_today')
}

// ----------------------------------------------------------------------------
// 15. Weekly summary — every Monday evening (cooldown 7 days)
// ----------------------------------------------------------------------------

async function checkWeeklySummary(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.weekly_summary) return

  // Only on Mondays
  if (new Date().getDay() !== 1) return

  const onCooldown = await hasCooldown(supabase, userId, 'weekly_summary', null, 24 * 7)
  if (onCooldown) return

  // Sum last week (Mon–Sun)
  const hoje         = new Date()
  const inicioSemana = new Date(hoje)
  inicioSemana.setDate(hoje.getDate() - 7) // last Monday
  const fimSemana    = new Date(hoje)
  fimSemana.setDate(hoje.getDate() - 1)   // last Sunday

  const { data: lancamentos } = await supabase
    .from('lancamentos')
    .select('categoria_id, valor')
    .eq('family_id', familyId)
    .eq('tipo', 'despesa')
    .eq('status', 'pago')
    .gte('data', inicioSemana.toISOString().substring(0, 10))
    .lte('data', fimSemana.toISOString().substring(0, 10))

  if (!lancamentos?.length) return

  const total = lancamentos.reduce((s, l) => s + (l.valor as number), 0)
  if (total <= 0) return

  // Find top category
  const porCategoria: Record<string, number> = {}
  for (const l of lancamentos) {
    if (!l.categoria_id) continue
    porCategoria[l.categoria_id as string] = (porCategoria[l.categoria_id as string] ?? 0) + (l.valor as number)
  }

  const topCatId = Object.entries(porCategoria).sort((a, b) => b[1] - a[1])[0]?.[0]
  let topCatNome = ''
  if (topCatId) {
    const { data: cat } = await supabase.from('categorias').select('nome').eq('id', topCatId).maybeSingle()
    topCatNome = cat?.nome as string ?? ''
  }

  const body = topCatNome
    ? `Você gastou ${formatBRL(total)} na semana passada. Maior gasto: ${topCatNome}.`
    : `Você gastou ${formatBRL(total)} na semana passada.`

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '📊 Resumo da semana',
    body,
    url    : '/app/relatorios',
    tag    : 'weekly_summary',
    urgent : false,
  }, 'weekly_summary')
}

// ----------------------------------------------------------------------------
// 16. Weekend budget — every Friday evening, shows leisure envelope balance
//     (cooldown 7 days)
// ----------------------------------------------------------------------------

const LAZER_KEYWORDS = ['lazer', 'entretenimento', 'diversão', 'restaurante', 'viagem', 'hobby']

async function checkWeekendBudget(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string,
  prefs      : Record<string, boolean>
): Promise<void> {
  if (!prefs.weekend_budget) return

  // Only on Fridays
  if (new Date().getDay() !== 5) return

  const onCooldown = await hasCooldown(supabase, userId, 'weekend_budget', null, 24 * 7)
  if (onCooldown) return

  const mesAtual = getMesAtual()
  const mesStart = `${mesAtual}-01`
  const mesEnd   = `${mesAtual}-31`

  // Find leisure-related categories in the budget
  const { data: orcamento } = await supabase
    .from('orcamentos_mensais')
    .select('id')
    .eq('family_id', familyId)
    .eq('mes_referencia', mesStart)
    .maybeSingle()

  if (!orcamento) return

  const { data: categorias } = await supabase
    .from('categorias')
    .select('id, nome')
    .eq('family_id', familyId)

  const lazerCats = (categorias ?? []).filter((c) =>
    LAZER_KEYWORDS.some((kw) => (c.nome as string).toLowerCase().includes(kw))
  )

  if (!lazerCats.length) return

  const { data: budgets } = await supabase
    .from('categorias_budget')
    .select('categoria_id, valor_orcado')
    .eq('orcamento_id', orcamento.id)
    .in('categoria_id', lazerCats.map((c) => c.id))

  if (!budgets?.length) return

  const { data: lancamentos } = await supabase
    .from('lancamentos')
    .select('categoria_id, valor, data, parcela_total, data_vencimento_fatura')
    .eq('family_id', familyId)
    .eq('tipo', 'despesa')
    .in('status', ['pago', 'projetado'])
    .in('categoria_id', lazerCats.map((c) => c.id))
    .gte('data', mesStart)
    .lte('data', mesEnd)

  const gastos: Record<string, number> = {}
  for (const l of lancamentos ?? []) {
    const mesEnv = (l.parcela_total > 1 && l.data_vencimento_fatura)
      ? (l.data_vencimento_fatura as string).substring(0, 7)
      : (l.data as string).substring(0, 7)
    if (mesEnv === mesAtual) {
      gastos[l.categoria_id as string] = (gastos[l.categoria_id as string] ?? 0) + (l.valor as number)
    }
  }

  let totalOrcado = 0
  let totalGasto  = 0
  for (const b of budgets) {
    totalOrcado += b.valor_orcado as number
    totalGasto  += gastos[b.categoria_id as string] ?? 0
  }

  const disponivel = totalOrcado - totalGasto
  if (disponivel <= 0) return

  const catNome = lazerCats[0].nome as string

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '🎉 Fim de semana chegando!',
    body   : `Você tem ${formatBRL(disponivel)} disponível em ${catNome} este mês. Aproveite com consciência!`,
    url    : '/app/envelopes',
    tag    : 'weekend_budget',
    urgent : false,
  }, 'weekend_budget')
}

// ----------------------------------------------------------------------------
// Process a single user
// ----------------------------------------------------------------------------

async function processUser(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  window     : 'morning' | 'evening'
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
    envelope_burst           : prefsRow?.envelope_burst            ?? true,
    expense_overdue          : prefsRow?.expense_overdue           ?? true,
    credit_card_limit        : prefsRow?.credit_card_limit         ?? true,
    trial_expiring           : prefsRow?.trial_expiring            ?? true,
    month_end_reminder       : prefsRow?.month_end_reminder        ?? true,
    savings_goals            : prefsRow?.savings_goals             ?? true,
    credit_card_due_date     : prefsRow?.credit_card_due_date      ?? true,
    unusual_spending         : prefsRow?.unusual_spending          ?? true,
    no_transactions_reminder : prefsRow?.no_transactions_reminder  ?? false,
    month_start_checkin      : prefsRow?.month_start_checkin       ?? true,
    perfect_month            : prefsRow?.perfect_month             ?? true,
    // evening-only preferences
    no_transactions_today    : prefsRow?.no_transactions_today     ?? false,
    weekly_summary           : prefsRow?.weekly_summary            ?? true,
    weekend_budget           : prefsRow?.weekend_budget            ?? true,
  }

  if (window === 'evening') {
    await Promise.allSettled([
      checkNoTransactionsToday(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkWeeklySummary(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkWeekendBudget(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
    ])
  } else {
    // morning (default): all 13 original checks
    await Promise.allSettled([
      checkEnvelopes(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkExpensesOverdue(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkCreditCards(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkTrial(supabase, supabaseUrl, serviceKey, userId, prefs),
      checkMonthEnd(supabase, supabaseUrl, serviceKey, userId, prefs),
      checkSavingsGoals(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkCreditCardDueDate(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkUnusualSpending(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkSemLancamentos(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
      checkMonthStart(supabase, supabaseUrl, serviceKey, userId, prefs),
      checkPerfectMonth(supabase, supabaseUrl, serviceKey, userId, familyId, prefs),
    ])
  }

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

  // Determine time window ('morning' default for backward-compat)
  let window: 'morning' | 'evening' = 'morning'
  try {
    const body = await req.json().catch(() => ({}))
    if (body?.window === 'evening') window = 'evening'
  } catch { /* no body */ }

  console.log(`[notify-daily-push] iniciando window=${window} — ${new Date().toISOString()}`)

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
      const result = await processUser(supabase, supabaseUrl, serviceKey, userId, window)
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
    JSON.stringify({ ok: true, window, total: userIds.length, processados, pulados, erros }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
