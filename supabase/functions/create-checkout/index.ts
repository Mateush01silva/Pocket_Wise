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
// ASAAS CONFIG
// ============================================================================

const ASAAS_API_URL = Deno.env.get('ASAAS_ENVIRONMENT') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? ''

function asaasHeaders() {
  return {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  }
}

// Planos do Pocket Wise
const PLANS = {
  monthly: { value: 12.90, cycle: 'MONTHLY', description: 'Pocket Wise - Plano Mensal' },
  annual: { value: 119.90, cycle: 'YEARLY', description: 'Pocket Wise - Plano Anual' },
} as const

// ============================================================================
// ASAAS API CALLS
// ============================================================================

async function findCustomerByEmail(email: string) {
  const res = await fetch(
    `${ASAAS_API_URL}/customers?email=${encodeURIComponent(email)}`,
    { headers: asaasHeaders() }
  )
  if (!res.ok) throw new Error(`Asaas findCustomer: ${await res.text()}`)
  const data = await res.json()
  return data.data?.[0] || null
}

async function createAsaasCustomer(name: string, email: string, userId: string) {
  const res = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify({
      name,
      email,
      externalReference: userId,
      notificationDisabled: false,
    }),
  })
  if (!res.ok) throw new Error(`Asaas createCustomer: ${await res.text()}`)
  return res.json()
}

async function createAsaasSubscription(
  customerId: string,
  plan: keyof typeof PLANS,
  userId: string,
  billingType: string
) {
  const config = PLANS[plan]
  const nextDueDate = new Date()
  nextDueDate.setDate(nextDueDate.getDate() + 1)

  const res = await fetch(`${ASAAS_API_URL}/subscriptions`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify({
      customer: customerId,
      billingType,
      value: config.value,
      nextDueDate: nextDueDate.toISOString().split('T')[0],
      cycle: config.cycle,
      description: config.description,
      externalReference: userId,
    }),
  })
  if (!res.ok) throw new Error(`Asaas createSubscription: ${await res.text()}`)
  return res.json()
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticar usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Ler plano do body
    const { plan, billingType = 'UNDEFINED' } = await req.json()

    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return new Response(
        JSON.stringify({ error: 'Plano inválido. Use "monthly" ou "annual".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Buscar perfil do usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .single()

    const userName = profile?.full_name || user.user_metadata?.full_name || 'Usuário'
    const userEmail = profile?.email || user.email || ''

    // 4. Buscar ou criar cliente na Asaas
    let customer = await findCustomerByEmail(userEmail)
    if (!customer) {
      customer = await createAsaasCustomer(userName, userEmail, user.id)
    }

    // 5. Criar assinatura na Asaas
    const subscription = await createAsaasSubscription(
      customer.id,
      plan as keyof typeof PLANS,
      user.id,
      billingType
    )

    // 6. Salvar IDs no Supabase
    await supabaseAdmin
      .from('assinaturas')
      .update({
        plan,
        asaas_customer_id: customer.id,
        asaas_subscription_id: subscription.id,
        asaas_payment_url: subscription.paymentLink || null,
      })
      .eq('user_id', user.id)

    // 7. Retornar resultado
    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          paymentLink: subscription.paymentLink,
        },
        customer: { id: customer.id },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro no create-checkout:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
