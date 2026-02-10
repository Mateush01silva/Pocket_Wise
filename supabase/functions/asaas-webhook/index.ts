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
    console.log('Webhook Asaas recebido:', payload.event)

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
  const payment = payload.payment
  if (!payment) return

  const userId = payment.externalReference
  if (!userId) {
    console.error('Payment sem externalReference (user_id)')
    return
  }

  // Buscar plano atual
  const { data: sub } = await supabaseAdmin
    .from('assinaturas')
    .select('plan')
    .eq('user_id', userId)
    .single()

  const plan = sub?.plan || 'monthly'

  // Calcular período
  const now = new Date()
  const periodEnd = new Date(now)
  if (plan === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Erro ao ativar assinatura:', error)
    throw error
  }

  console.log(`Assinatura ativada: user=${userId}, plan=${plan}`)
}

async function handlePaymentOverdue(payload: AsaasWebhookPayload) {
  const userId = payload.payment?.externalReference
  if (!userId) return

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw error
  console.log(`Assinatura expirada (pagamento vencido): user=${userId}`)
}

async function handlePaymentRefunded(payload: AsaasWebhookPayload) {
  const userId = payload.payment?.externalReference
  if (!userId) return

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw error
  console.log(`Assinatura cancelada (estorno): user=${userId}`)
}

async function handleSubscriptionCanceled(payload: AsaasWebhookPayload) {
  const userId = payload.subscription?.externalReference
  if (!userId) return

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'canceled',
      asaas_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) throw error
  console.log(`Assinatura cancelada: user=${userId}`)
}
