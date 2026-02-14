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

// ============================================================================
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  console.log('>>> cancel-subscription: request recebido, method =', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== cancel-subscription iniciado ===')
    console.log('ASAAS_ENVIRONMENT:', Deno.env.get('ASAAS_ENVIRONMENT'))
    console.log('ASAAS_API_KEY definida:', !!ASAAS_API_KEY)
    console.log('ASAAS_API_URL:', ASAAS_API_URL)

    // 1. Autenticar usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Erro: sem header de autenticação')
      return new Response(
        JSON.stringify({ error: 'Token de autenticação não fornecido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Passo 1: auth header presente')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      console.error('Erro: autenticação falhou:', authError?.message)
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Passo 2: usuário autenticado, id =', user.id, 'email =', user.email)

    // 2. Buscar assinatura do usuário
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: sub, error: subError } = await supabaseAdmin
      .from('plano_usuario')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (subError) {
      console.error('Erro ao buscar plano_usuario:', JSON.stringify(subError))
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar assinatura: ' + subError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!sub) {
      console.error('Nenhuma assinatura encontrada para user_id =', user.id)
      return new Response(
        JSON.stringify({ error: 'Assinatura não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Passo 3: assinatura encontrada:', JSON.stringify({
      status: sub.status,
      plan: sub.plan,
      asaas_subscription_id: sub.asaas_subscription_id,
      current_period_end: sub.current_period_end,
      cancel_at_period_end: sub.cancel_at_period_end,
    }))

    if (sub.status !== 'active') {
      console.error('Status da assinatura não é active:', sub.status)
      return new Response(
        JSON.stringify({ error: 'Assinatura não está ativa (status atual: ' + sub.status + ')' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (sub.cancel_at_period_end === true) {
      console.log('Assinatura já marcada para cancelamento')
      return new Response(
        JSON.stringify({ error: 'Assinatura já está marcada para cancelamento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Cancelar assinatura na Asaas
    let asaasCanceled = false
    if (sub.asaas_subscription_id) {
      console.log('Passo 4: cancelando na Asaas, subscription_id =', sub.asaas_subscription_id)
      try {
        const asaasRes = await fetch(
          `${ASAAS_API_URL}/subscriptions/${sub.asaas_subscription_id}`,
          {
            method: 'DELETE',
            headers: asaasHeaders(),
          }
        )

        const asaasBody = await asaasRes.text()
        console.log('Asaas DELETE status:', asaasRes.status)
        console.log('Asaas DELETE body:', asaasBody)

        if (!asaasRes.ok) {
          console.error('Erro Asaas DELETE (status ' + asaasRes.status + '):', asaasBody)
        } else {
          asaasCanceled = true
          console.log('Assinatura cancelada na Asaas com sucesso')
        }
      } catch (asaasErr) {
        console.error('Exceção ao chamar Asaas:', asaasErr)
      }
    } else {
      console.log('Passo 4: sem asaas_subscription_id, pulando Asaas')
    }

    // 4. Marcar no banco
    console.log('Passo 5: atualizando banco...')
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('plano_usuario')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('id, status, cancel_at_period_end, current_period_end')

    if (updateError) {
      console.error('Erro UPDATE plano_usuario:', JSON.stringify(updateError))
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar banco: ' + updateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Passo 6: banco atualizado:', JSON.stringify(updated))
    console.log('=== cancel-subscription CONCLUÍDO com sucesso ===')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assinatura será cancelada no fim do período atual',
        current_period_end: sub.current_period_end,
        asaas_canceled: asaasCanceled,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('ERRO INESPERADO cancel-subscription:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: msg || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
