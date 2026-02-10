import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cliente Supabase com service_role para operações administrativas
export const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)
