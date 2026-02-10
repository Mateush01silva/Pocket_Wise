import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { supabaseAdmin } from '../_shared/supabase-admin.ts'

// Eventos da Asaas que nos interessam
// Docs: https://docs.asaas.com/docs/webhooks
type AsaasEvent =
  | 'PAYMENT_CONFIRMED'       // Pagamento confirmado (boleto/pix)
  | 'PAYMENT_RECEIVED'        // Pagamento recebido (cartão de crédito)
  | 'PAYMENT_OVERDUE'         // Pagamento vencido
  | 'PAYMENT_DELETED'         // Pagamento removido
  | 'PAYMENT_REFUNDED'        // Pagamento estornado
  | 'SUBSCRIPTION_DELETED'    // Assinatura removida/cancelada
  | 'SUBSCRIPTION_UPDATED'    // Assinatura atualizada

interface AsaasWebhookPayload {
  event: AsaasEvent
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

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
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

  // Buscar a assinatura do usuário para saber o plano
  const { data: subscription } = await supabaseAdmin
    .from('assinaturas')
    .select('plan')
    .eq('user_id', userId)
    .single()

  const plan = subscription?.plan || 'monthly'

  // Calcular período da assinatura
  const now = new Date()
  const periodEnd = new Date(now)
  if (plan === 'annual') {
    periodEnd.setFullYear(periodEnd.getFullYear() + 1)
  } else {
    periodEnd.setMonth(periodEnd.getMonth() + 1)
  }

  // Ativar assinatura
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

  console.log(`Assinatura ativada para usuário ${userId} - plano ${plan}`)
}

async function handlePaymentOverdue(payload: AsaasWebhookPayload) {
  const payment = payload.payment
  if (!payment) return

  const userId = payment.externalReference
  if (!userId) return

  // Marcar como expirada após vencimento
  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Erro ao expirar assinatura:', error)
    throw error
  }

  console.log(`Assinatura expirada para usuário ${userId} - pagamento vencido`)
}

async function handlePaymentRefunded(payload: AsaasWebhookPayload) {
  const payment = payload.payment
  if (!payment) return

  const userId = payment.externalReference
  if (!userId) return

  // Cancelar assinatura após estorno
  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'canceled',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Erro ao cancelar assinatura (estorno):', error)
    throw error
  }

  console.log(`Assinatura cancelada para usuário ${userId} - pagamento estornado`)
}

async function handleSubscriptionCanceled(payload: AsaasWebhookPayload) {
  const sub = payload.subscription
  if (!sub) return

  const userId = sub.externalReference
  if (!userId) return

  const { error } = await supabaseAdmin
    .from('assinaturas')
    .update({
      status: 'canceled',
      asaas_subscription_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  if (error) {
    console.error('Erro ao cancelar assinatura:', error)
    throw error
  }

  console.log(`Assinatura cancelada para usuário ${userId}`)
}
