import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { createCustomer, findCustomerByEmail, createSubscription, PLANS } from '../_shared/asaas.ts'

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Autenticar o usuário via token JWT do Supabase
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

    // 2. Ler o plano desejado do body
    const { plan, billingType = 'UNDEFINED' } = await req.json()

    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return new Response(
        JSON.stringify({ error: 'Plano inválido. Use "monthly" ou "annual".' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const planConfig = PLANS[plan as keyof typeof PLANS]

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
    let asaasCustomer = await findCustomerByEmail(userEmail)

    if (!asaasCustomer) {
      asaasCustomer = await createCustomer({
        name: userName,
        email: userEmail,
        externalReference: user.id,
      })
    }

    // 5. Criar assinatura na Asaas
    const subscription = await createSubscription({
      customer: asaasCustomer.id,
      billingType,
      value: planConfig.value,
      cycle: planConfig.cycle,
      description: planConfig.description,
      externalReference: user.id,
    })

    // 6. Salvar IDs da Asaas na tabela de assinaturas do Supabase
    await supabaseAdmin
      .from('assinaturas')
      .update({
        plan,
        asaas_customer_id: asaasCustomer.id,
        asaas_subscription_id: subscription.id,
        asaas_payment_url: subscription.paymentLink || null,
      })
      .eq('user_id', user.id)

    // 7. Retornar dados para o frontend
    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          paymentLink: subscription.paymentLink,
        },
        customer: {
          id: asaasCustomer.id,
        },
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
