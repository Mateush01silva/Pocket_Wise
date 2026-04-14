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
// MAIN HANDLER
// ============================================================================

serve(async (req) => {
  console.log('>>> update-user-email: request recebido, method =', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('=== update-user-email iniciado ===')

    // 1. Verificar autenticação do chamador
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Erro: sem header de autenticação')
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
      console.error('Erro: autenticação falhou:', authError?.message)
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Passo 1: chamador autenticado, id =', user.id)

    // 2. Verificar se chamador é admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || callerProfile?.role !== 'admin') {
      console.error('Acesso negado: usuário não é admin, role =', callerProfile?.role)
      return new Response(
        JSON.stringify({ error: 'Acesso negado: apenas administradores podem alterar e-mails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Passo 2: chamador é admin')

    // 3. Extrair e validar payload
    const { targetUserId, newEmail } = await req.json()

    if (!targetUserId || !newEmail) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros obrigatórios ausentes: targetUserId, newEmail' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newEmail)) {
      return new Response(
        JSON.stringify({ error: 'E-mail inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Passo 3: payload válido, targetUserId =', targetUserId, 'newEmail =', newEmail)

    // 4. Atualizar email em auth.users via Admin API
    // Isso dispara automaticamente o e-mail de confirmação para o novo endereço
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUserId,
      { email: newEmail }
    )

    if (authUpdateError) {
      console.error('Erro ao atualizar auth.users:', authUpdateError.message)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar e-mail: ' + authUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Passo 4: auth.users atualizado com sucesso')

    // 5. Atualizar email em public.users
    const { error: profileUpdateError } = await supabaseAdmin
      .from('users')
      .update({ email: newEmail, updated_at: new Date().toISOString() })
      .eq('id', targetUserId)

    if (profileUpdateError) {
      console.error('Erro ao atualizar public.users:', profileUpdateError.message)
      return new Response(
        JSON.stringify({ error: 'E-mail atualizado no auth, mas erro no perfil: ' + profileUpdateError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    console.log('Passo 5: public.users atualizado com sucesso')

    console.log('=== update-user-email CONCLUÍDO com sucesso ===')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'E-mail atualizado. Confirmação enviada ao novo endereço.',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('ERRO INESPERADO update-user-email:', error)
    const msg = error instanceof Error ? error.message : String(error)
    return new Response(
      JSON.stringify({ error: msg || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
