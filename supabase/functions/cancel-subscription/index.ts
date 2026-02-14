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

    if (subError || !sub) {
      return new Response(
        JSON.stringify({ error: 'Assinatura não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (sub.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Assinatura não está ativa' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (sub.cancel_at_period_end) {
      return new Response(
        JSON.stringify({ error: 'Assinatura já está marcada para cancelamento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 3. Cancelar assinatura na Asaas (se tiver ID)
    if (sub.asaas_subscription_id) {
      console.log('Cancelando assinatura na Asaas:', sub.asaas_subscription_id)
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

      if (!res.ok) {
        const errorText = await res.text()
        console.error('Erro ao cancelar na Asaas:', errorText)
        // Continua mesmo se falhar na Asaas - o importante é marcar no banco
      } else {
        console.log('Assinatura cancelada na Asaas com sucesso')
      }
    }

    // 4. Marcar no banco: cancelar no fim do período (não imediatamente)
    const { error: updateError } = await supabaseAdmin
      .from('plano_usuario')
      .update({
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Erro ao atualizar plano_usuario:', updateError)
      throw updateError
    }

    console.log(`Assinatura marcada para cancelamento: user=${user.id}, period_end=${sub.current_period_end}`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Assinatura será cancelada no fim do período atual',
        current_period_end: sub.current_period_end,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Erro no cancel-subscription:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
