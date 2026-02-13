import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================================================
// SUPABASE ADMIN CLIENT
// ============================================================================

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

// ============================================================================
// TYPES
// ============================================================================

interface AsaasWebhookPayload {
  event: string
  payment?: {
    id: string
    customer: string
    subscription: string
    value: number
    status: string
    billingType: string
    externalReference: string // user_id
  }
  subscription?: {
    id: string
    customer: string
    status: string
    externalReference: string // user_id
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Resolve o user_id a partir do payload do webhook.
 * Tenta, nesta ordem:
 *   1. payment.externalReference
 *   2. subscription.externalReference
 *   3. Busca no banco por asaas_subscription_id (payment.subscription)
 *   4. Busca no banco por asaas_customer_id (payment.customer)
 */
async function resolveUserId(payload: AsaasWebhookPayload): Promise<string | null> {
  // 1. externalReference no payment
  const fromPayment = payload.payment?.externalReference
  if (fromPayment) {
    console.log('resolveUserId: encontrado via payment.externalReference =', fromPayment)
    return fromPayment
  }

  // 2. externalReference na subscription
  const fromSub = payload.subscription?.externalReference
  if (fromSub) {
    console.log('resolveUserId: encontrado via subscription.externalReference =', fromSub)
    return fromSub
  }

  // 3. Buscar por asaas_subscription_id
  const subscriptionId = payload.payment?.subscription
  if (subscriptionId) {
    console.log('resolveUserId: buscando por asaas_subscription_id =', subscriptionId)
    const { data } = await supabaseAdmin
      .from('plano_usuario')
      .select('user_id')
      .eq('asaas_subscription_id', subscriptionId)
      .single()
    if (data?.user_id) {
      console.log('resolveUserId: encontrado via asaas_subscription_id, user_id =', data.user_id)
      return data.user_id
    }
  }

  // 4. Buscar por asaas_customer_id
  const customerId = payload.payment?.customer
  if (customerId) {
    console.log('resolveUserId: buscando por asaas_customer_id =', customerId)
    const { data } = await supabaseAdmin
      .from('plano_usuario')
      .select('user_id')
      .eq('asaas_customer_id', customerId)
      .single()
    if (data?.user_id) {
      console.log('resolveUserId: encontrado via asaas_customer_id, user_id =', data.user_id)
      return data.user_id
    }
  }

  console.error('resolveUserId: NÃO foi possível resolver user_id. Payload:', JSON.stringify(payload))
  return null
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'content-type, asaas-access-token',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  try {
    // Verificar token de webhook (segurança adicional)
    const webhookToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN')
    const receivedToken = req.headers.get('asaas-access-token')

    if (webhookToken && receivedToken !== webhookToken) {
      console.warn('Webhook token inválido recebido')
      return new Response(
        JSON.stringify({ error: 'Token inválido' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const payload: AsaasWebhookPayload = await req.json()
    console.log('=== Webhook Asaas recebido ===')
    console.log('Evento:', payload.event)
    console.log('Payload completo:', JSON.stringify(payload))

    switch (payload.event) {
      case 'PAYMENT_CONFIRMED':
      case 'PAYMENT_RECEIVED':
        await handlePaymentConfirmed(payload)
        break

      case 'PAYMENT_OVERDUE':
        await handlePaymentOverdue(payload)
        break

      case 'PAYMENT_REFUNDED':
        await handlePaymentRefunded(payload)
        break

      case 'SUBSCRIPTION_DELETED':
        await handleSubscriptionCanceled(payload)
        break

      default:
        console.log(`Evento não tratado: ${payload.event}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro no webhook Asaas:', error)
    // Retorna 200 para evitar que a Asaas fique reenviando
    return new Response(
      JSON.stringify({ received: true, error: error.message }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ============================================================================
// HANDLERS
// ============================================================================

async function handlePaymentConfirmed(payload: AsaasWebhookPayload) {
  const userId = await resolveUserId(payload)
  if (!userId) {
    console.error('handlePaymentConfirmed: Impossível identificar o usuário. Abortando.')
    return
  }

  // Buscar plano atual
  const { data: sub, error: fetchError } = await supabaseAdmin
    .from('plano_usuario')
    .select('plan, status')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    console.error('handlePaymentConfirmed: Erro ao buscar plano_usuario:', fetchError)
    throw fetchError
  }

  if (!sub) {
    console.error('handlePaymentConfirmed: Nenhum registro plano_usuario encontrado para user_id =', userId)
    return
  }

  console.log(`handlePaymentConfirmed: user=${userId}, status_atual=${sub.status}, plan=${sub.plan}`)

  const plan = sub.plan || 'monthly'

  // Calcular período
  const now = new Date()
  const periodEnd = new Date(now)
  if (plan === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const { data: updated, error } = await supabaseAdmin
    .from('plano_usuario')
    .update({
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId)
    .select('id, status')

  if (error) {
    console.error('handlePaymentConfirmed: Erro ao atualizar para active:', error)
    throw error
  }

  console.log(`handlePaymentConfirmed: UPDATE resultado:`, JSON.stringify(updated))
  console.log(`Assinatura ativada com sucesso: user=${userId}, plan=${plan}`)
}

async function handlePaymentOverdue(payload: AsaasWebhookPayload) {
  const userId = await resolveUserId(payload)
  if (!userId) return

  const { data: updated, error } = await supabaseAdmin
    .from('plano_usuario')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('id, status')

  if (error) throw error
  console.log(`Assinatura expirada (pagamento vencido): user=${userId}`, JSON.stringify(updated))
}

async function handlePaymentRefunded(payload: AsaasWebhookPayload) {
  const userId = await resolveUserId(payload)
  if (!userId) return

  const { data: updated, error } = await supabaseAdmin
    .from('plano_usuario')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('id, status')

  if (error) throw error
  console.log(`Assinatura cancelada (estorno): user=${userId}`, JSON.stringify(updated))
}

async function handleSubscriptionCanceled(payload: AsaasWebhookPayload) {
  const userId = await resolveUserId(payload)
  if (!userId) return

  const { data: updated, error } = await supabaseAdmin
    .from('plano_usuario')
    .update({
      status: 'canceled',
      asaas_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .select('id, status')

  if (error) throw error
  console.log(`Assinatura cancelada: user=${userId}`, JSON.stringify(updated))
}
