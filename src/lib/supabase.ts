import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Check if we should use localStorage (MVP mode)
export const useLocalStorage = import.meta.env.VITE_USE_LOCAL_STORAGE === 'true'

// Create Supabase client (only if not in localStorage mode)
export const supabase = !useLocalStorage && supabaseUrl && supabaseAnonKey
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null

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
