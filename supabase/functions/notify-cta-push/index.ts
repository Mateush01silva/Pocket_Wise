import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// notify-cta-push — CTAs de conversão para usuários no plano Explorador
//
// Runs daily at 12:00 BRT (15:00 UTC) via pg_cron.
// Only processes users with tier = 'explorador' and active push subscriptions.
//
// CTA types (priority order — max 1 CTA per user per run):
//   1. cta_limite_transacoes  — urgência: >15/20 transações no mês (cooldown: 7d)
//   2. cta_milestone_30d      — celebração: 30 dias de uso           (cooldown: 30d)
//   3. cta_feature_discovery  — descoberta: recursos bloqueados      (cooldown: 14d)
//   4. cta_ai_teaser          — upsell: assistente IA no Mestre      (cooldown: 21d)
//
// All CTAs navigate to /app/perfil?tab=planos.
// Respects `push_notification_preferences.cta_upgrade` opt-in.
// ============================================================================

type SupabaseAdmin = ReturnType<typeof createClient>

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

async function hasCooldown(
  supabase          : SupabaseAdmin,
  userId            : string,
  notificationType  : string,
  refKey            : string | null,
  cooldownHours     : number
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
  supabaseUrl      : string,
  serviceKey       : string,
  userId           : string,
  payload          : Record<string, unknown>,
  notificationType : string,
  refKey?          : string
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
      console.error(`[notify-cta-push] sendPush HTTP ${res.status} user=${userId}: ${text}`)
    }
  } catch (err) {
    console.error(`[notify-cta-push] sendPush error user=${userId}:`, err)
  }
}

// ----------------------------------------------------------------------------
// CTA 1: Urgência — próximo ao limite de transações (>15 de 20)
// ----------------------------------------------------------------------------

async function checkCtaLimiteTransacoes(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string
): Promise<boolean> {
  const onCooldown = await hasCooldown(supabase, userId, 'cta_limite_transacoes', null, 24 * 7)
  if (onCooldown) return false

  const now      = new Date()
  const mesStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const mesEnd   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`

  const { count } = await supabase
    .from('lancamentos')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .gte('data', mesStart)
    .lte('data', mesEnd)

  const qtd = count ?? 0
  if (qtd <= 15) return false

  const restam = 20 - qtd
  const body   = restam > 0
    ? `Você já registrou ${qtd} de 20 transações este mês. Restam apenas ${restam}. No Planejador é ilimitado!`
    : `Você atingiu o limite de 20 transações do Explorador este mês. Faça upgrade para continuar sem interrupção.`

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '📊 Você está quase no limite',
    body,
    url    : '/app/perfil?tab=planos',
    tag    : 'cta_upgrade',
    urgent : qtd >= 20,
  }, 'cta_limite_transacoes')

  return true
}

// ----------------------------------------------------------------------------
// CTA 2: Milestone — 30 dias de uso do app
// ----------------------------------------------------------------------------

async function checkCtaMilestone30d(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string
): Promise<boolean> {
  const onCooldown = await hasCooldown(supabase, userId, 'cta_milestone_30d', null, 24 * 30)
  if (onCooldown) return false

  const { data: user } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle()

  if (!user?.created_at) return false

  const diasDeUso = Math.floor(
    (Date.now() - new Date(user.created_at as string).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diasDeUso < 30) return false

  const meses = Math.floor(diasDeUso / 30)
  const titulo = meses === 1 ? '🎉 1 mês de Pocket Wise!' : `🎉 ${meses} meses de Pocket Wise!`

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : titulo,
    body   : 'Você está dominando suas finanças! Pronto para ir mais fundo com o Planejador ou o Mestre?',
    url    : '/app/perfil?tab=planos',
    tag    : 'cta_upgrade',
    urgent : false,
  }, 'cta_milestone_30d')

  return true
}

// ----------------------------------------------------------------------------
// CTA 3: Descoberta — destaca um recurso bloqueado que o usuário poderia usar
// ----------------------------------------------------------------------------

const DISCOVERY_MESSAGES = [
  {
    title : '💳 Você tem mais de 1 cartão?',
    body  : 'No Explorador, você gerencia 1 cartão. No Planejador, todos os seus cartões, sem limite.',
  },
  {
    title : '📊 Relatórios financeiros completos',
    body  : 'Veja sua evolução mês a mês, identifique tendências e tome decisões com dados reais. Disponível no Planejador.',
  },
  {
    title : '👨‍👩‍👧 Finanças a dois, sem complicação',
    body  : 'Gerencie o orçamento familiar com seu parceiro(a) no mesmo app. Disponível no Planejador.',
  },
  {
    title : '📁 Quantas contas você controla?',
    body  : 'No Explorador é 1 conta. No Planejador, todas as suas contas num só lugar.',
  },
]

async function checkCtaFeatureDiscovery(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string
): Promise<boolean> {
  const onCooldown = await hasCooldown(supabase, userId, 'cta_feature_discovery', null, 24 * 14)
  if (onCooldown) return false

  // Only send to engaged users (at least 5 transactions in the last 7 days)
  const seteAtras = new Date()
  seteAtras.setDate(seteAtras.getDate() - 7)

  const { count } = await supabase
    .from('lancamentos')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .gte('data', seteAtras.toISOString().substring(0, 10))

  if ((count ?? 0) < 5) return false

  // Rotate message based on week number (deterministic, varies per user each week)
  const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000))
  const msg     = DISCOVERY_MESSAGES[weekNum % DISCOVERY_MESSAGES.length]

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : msg.title,
    body   : msg.body,
    url    : '/app/perfil?tab=planos',
    tag    : 'cta_upgrade',
    urgent : false,
  }, 'cta_feature_discovery')

  return true
}

// ----------------------------------------------------------------------------
// CTA 4: Teaser de IA — aposta no upsell para o Mestre
// ----------------------------------------------------------------------------

async function checkCtaAiTeaser(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string,
  familyId   : string
): Promise<boolean> {
  const onCooldown = await hasCooldown(supabase, userId, 'cta_ai_teaser', null, 24 * 21)
  if (onCooldown) return false

  // Only for engaged users (at least 5 transactions in the last 30 days)
  const trintaAtras = new Date()
  trintaAtras.setDate(trintaAtras.getDate() - 30)

  const { count } = await supabase
    .from('lancamentos')
    .select('id', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .gte('data', trintaAtras.toISOString().substring(0, 10))

  if ((count ?? 0) < 5) return false

  await sendPush(supabaseUrl, serviceKey, userId, {
    title  : '🤖 Seu parceiro financeiro com IA',
    body   : 'O assistente do Pocket Wise analisa seus gastos, sugere ajustes e responde suas dúvidas 24/7. Disponível no Mestre.',
    url    : '/app/perfil?tab=planos',
    tag    : 'cta_upgrade',
    urgent : false,
  }, 'cta_ai_teaser')

  return true
}

// ----------------------------------------------------------------------------
// Process a single explorador user (max 1 CTA per run, prioritized)
// ----------------------------------------------------------------------------

async function processUser(
  supabase   : SupabaseAdmin,
  supabaseUrl: string,
  serviceKey : string,
  userId     : string
): Promise<{ skipped?: string; processed?: boolean; cta?: string }> {
  // Get family
  const { data: userData } = await supabase
    .from('users')
    .select('family_id')
    .eq('id', userId)
    .maybeSingle()

  const familyId = userData?.family_id as string | undefined
  if (!familyId) return { skipped: 'sem family_id' }

  // Confirm explorador tier and not in active trial
  const { data: plano } = await supabase
    .from('plano_usuario')
    .select('tier, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (!plano) return { skipped: 'sem plano' }
  if ((plano.tier as string) !== 'explorador') return { skipped: 'nao-explorador' }
  if ((plano.status as string) === 'trial') return { skipped: 'em-trial' }

  // Check opt-in preference
  const { data: prefsRow } = await supabase
    .from('push_notification_preferences')
    .select('cta_upgrade')
    .eq('user_id', userId)
    .maybeSingle()

  const ctaEnabled = prefsRow?.cta_upgrade ?? true
  if (!ctaEnabled) return { skipped: 'cta-desativado' }

  // Run CTAs in priority order — stop at first one fired
  if (await checkCtaLimiteTransacoes(supabase, supabaseUrl, serviceKey, userId, familyId)) {
    return { processed: true, cta: 'cta_limite_transacoes' }
  }

  if (await checkCtaMilestone30d(supabase, supabaseUrl, serviceKey, userId)) {
    return { processed: true, cta: 'cta_milestone_30d' }
  }

  if (await checkCtaFeatureDiscovery(supabase, supabaseUrl, serviceKey, userId, familyId)) {
    return { processed: true, cta: 'cta_feature_discovery' }
  }

  if (await checkCtaAiTeaser(supabase, supabaseUrl, serviceKey, userId, familyId)) {
    return { processed: true, cta: 'cta_ai_teaser' }
  }

  return { skipped: 'sem-cta-elegivel' }
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

  console.log(`[notify-cta-push] iniciando — ${new Date().toISOString()}`)

  // Fetch all users with active push subscriptions
  const { data: rows, error } = await supabase
    .from('push_subscriptions')
    .select('user_id')
    .eq('is_active', true)

  if (error) {
    console.error('[notify-cta-push] erro ao buscar subscriptions:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id as string))]
  console.log(`[notify-cta-push] ${userIds.length} usuário(s) com subscription ativa`)

  const resultados: Array<{ user_id: string } & Record<string, unknown>> = []

  for (const userId of userIds) {
    try {
      const result = await processUser(supabase, supabaseUrl, serviceKey, userId)
      resultados.push({ user_id: userId, ...result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[notify-cta-push] ERRO user=${userId}:`, msg)
      resultados.push({ user_id: userId, error: msg })
    }
  }

  const processados = resultados.filter((r) => r.processed).length
  const pulados     = resultados.filter((r) => r.skipped).length
  const erros       = resultados.filter((r) => r.error).length

  console.log(`[notify-cta-push] concluído — ctas_enviados=${processados} pulados=${pulados} erros=${erros}`)

  return new Response(
    JSON.stringify({ ok: true, total: userIds.length, ctas_enviados: processados, pulados, erros }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
