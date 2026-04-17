import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if we should use localStorage (MVP mode)
export const useLocalStorage = import.meta.env.VITE_USE_LOCAL_STORAGE === 'true'

// Use a global singleton to prevent multiple GoTrueClient instances
// (can happen due to module hot-reloading or duplicate imports in the bundle)
const GLOBAL_KEY = '__pocketwise_supabase__'
type GlobalWithSupabase = typeof globalThis & { [GLOBAL_KEY]?: ReturnType<typeof createClient<Database>> | null }

function getOrCreateClient() {
  if (useLocalStorage || !supabaseUrl || !supabaseAnonKey) return null
  const g = globalThis as GlobalWithSupabase
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  }
  return g[GLOBAL_KEY]!
}

export const supabase = getOrCreateClient()

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !useLocalStorage && supabase !== null
}

// Helper to get the current user (uses local session, no network call)
export const getCurrentUser = async () => {
  if (!supabase) return null

  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    return null
  }

  return session.user
}

// Cache do family_id para evitar queries repetidas
let cachedFamilyId: string | null = null
let cachedUserId: string | null = null

// Helper to get the user's family ID
export const getUserFamilyId = async (): Promise<string | null> => {
  if (!supabase) return null

  const user = await getCurrentUser()
  if (!user) return null

  // Retornar cache se for o mesmo usuário
  if (cachedFamilyId && cachedUserId === user.id) {
    return cachedFamilyId
  }

  const { data, error } = await (supabase as any)
    .from('users')
    .select('family_id')
    .eq('id', user.id)
    .single()

  if (error) {
    console.error('Error getting user family ID:', error)
    return null
  }

  const familyId = (data as { family_id: string | null })?.family_id || null
  cachedFamilyId = familyId
  cachedUserId = user.id
  return familyId
}

// Limpar cache de family_id (chamar no logout)
export const clearFamilyIdCache = () => {
  cachedFamilyId = null
  cachedUserId = null
}

// Type definitions for Supabase will be generated
// For now, we use a placeholder that we'll update later
export type { Database }
