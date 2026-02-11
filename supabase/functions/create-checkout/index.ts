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

async function updateAsaasCustomer(customerId: string, cpfCnpj: string) {
  const res = await fetch(`${ASAAS_API_URL}/customers/${customerId}`, {
    method: 'PUT',
    headers: asaasHeaders(),
    body: JSON.stringify({ cpfCnpj }),
  })
  if (!res.ok) throw new Error(`Asaas updateCustomer: ${await res.text()}`)
  return res.json()
}

async function createAsaasCustomer(name: string, email: string, userId: string, cpfCnpj?: string) {
  const res = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: asaasHeaders(),
    body: JSON.stringify({
      name,
      email,
      cpfCnpj: cpfCnpj || undefined,
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
    console.log('=== create-checkout iniciado ===')
    console.log('ASAAS_ENVIRONMENT:', Deno.env.get('ASAAS_ENVIRONMENT'))
    console.log('ASAAS_API_KEY definida:', !!ASAAS_API_KEY)
    console.log('ASAAS_API_URL:', ASAAS_API_URL)

    // 1. Autenticar usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Sem header de autenticação')
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

    // 2. Ler plano e CPF do body
    const { plan, billingType = 'UNDEFINED', cpfCnpj } = await req.json()

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
    console.log('Usuário:', userEmail, '| Plano:', plan)

    // 4. Buscar ou criar cliente na Asaas
    console.log('Buscando cliente na Asaas...')
    let customer = await findCustomerByEmail(userEmail)
    if (!customer) {
      console.log('Cliente não encontrado, criando...')
      customer = await createAsaasCustomer(userName, userEmail, user.id, cpfCnpj)
    } else if (cpfCnpj) {
      // Cliente já existe mas pode não ter CPF cadastrado - atualizar
      console.log('Cliente já existe, atualizando CPF/CNPJ...')
      customer = await updateAsaasCustomer(customer.id, cpfCnpj)
    }
    console.log('Cliente Asaas:', customer.id)

    // 5. Criar assinatura na Asaas
    console.log('Criando assinatura na Asaas...')
    const subscription = await createAsaasSubscription(
      customer.id,
      plan as keyof typeof PLANS,
      user.id,
      billingType
    )

    console.log('Assinatura criada:', subscription.id, '| Link:', subscription.paymentLink)

    // 6. Salvar IDs no Supabase
    await supabaseAdmin
      .from('plano_usuario')
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
