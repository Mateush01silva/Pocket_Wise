import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ASAAS_API_URL = Deno.env.get('ASAAS_ENVIRONMENT') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3'

const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY') ?? ''

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== cancel-subscription iniciado ===')
    console.log('ASAAS_API_URL:', ASAAS_API_URL)
    console.log('ASAAS_API_KEY definida:', !!ASAAS_API_KEY)

    // 1. Autenticar usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Erro: sem header de autenticação')
      return jsonResponse({ error: 'Token de autenticação não fornecido' }, 401)
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
      return jsonResponse({ error: 'Usuário não autenticado' }, 401)
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
      console.error('Erro ao buscar plano_usuario:', subError)
      return jsonResponse({ error: 'Erro ao buscar assinatura: ' + subError.message }, 500)
    }
    if (!sub) {
      console.error('Nenhuma assinatura encontrada para user_id =', user.id)
      return jsonResponse({ error: 'Assinatura não encontrada' }, 404)
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
      return jsonResponse({ error: `Assinatura não está ativa (status atual: ${sub.status})` }, 400)
    }

    if (sub.cancel_at_period_end) {
      console.log('Assinatura já marcada para cancelamento')
      return jsonResponse({ error: 'Assinatura já está marcada para cancelamento' }, 400)
    }

    // 3. Cancelar assinatura na Asaas (se tiver ID)
    let asaasCanceled = false
    if (sub.asaas_subscription_id) {
      console.log('Passo 4: cancelando na Asaas, subscription_id =', sub.asaas_subscription_id)
      try {
        const res = await fetch(
          `${ASAAS_API_URL}/subscriptions/${sub.asaas_subscription_id}`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'access_token': ASAAS_API_KEY,
            },
          }
        )

        const responseText = await res.text()
        console.log('Asaas DELETE response status:', res.status)
        console.log('Asaas DELETE response body:', responseText)

        if (!res.ok) {
          console.error('Erro ao cancelar na Asaas (status ' + res.status + '):', responseText)
          // Continua mesmo se falhar na Asaas - o importante é marcar no banco
        } else {
          asaasCanceled = true
          console.log('Assinatura cancelada na Asaas com sucesso')
        }
      } catch (asaasError) {
        console.error('Exceção ao chamar Asaas DELETE:', asaasError)
        // Continua mesmo se falhar na Asaas
      }
    } else {
      console.log('Passo 4: sem asaas_subscription_id, pulando cancelamento na Asaas')
    }

    // 4. Marcar no banco: cancelar no fim do período (não imediatamente)
    console.log('Passo 5: atualizando banco de dados...')
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('plano_usuario')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .select('id, status, cancel_at_period_end, current_period_end')

    if (updateError) {
      console.error('Erro ao atualizar plano_usuario:', JSON.stringify(updateError))
      return jsonResponse({
        error: 'Erro ao atualizar banco de dados: ' + updateError.message,
        asaas_canceled: asaasCanceled,
      }, 500)
    }

    console.log('Passo 6: banco atualizado com sucesso:', JSON.stringify(updated))
    console.log(`=== cancel-subscription concluído: user=${user.id}, period_end=${sub.current_period_end}, asaas_canceled=${asaasCanceled} ===`)

    return jsonResponse({
      success: true,
      message: 'Assinatura será cancelada no fim do período atual',
      current_period_end: sub.current_period_end,
      asaas_canceled: asaasCanceled,
    })
  } catch (error) {
    console.error('Erro inesperado no cancel-subscription:', error)
    return jsonResponse({
      error: (error instanceof Error ? error.message : String(error)) || 'Erro interno do servidor'
    }, 500)
  }
})
