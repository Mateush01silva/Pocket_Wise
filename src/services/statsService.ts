import { createClient } from '@supabase/supabase-js'

export interface PlatformStats {
  totalUsers: number
  totalTransactions: number
  totalMoneyManaged: number
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Client dedicado para queries públicas (sem depender do auth)
const publicClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

export async function getPlatformStats(): Promise<PlatformStats> {
  if (!publicClient) {
    // Fallback quando Supabase não está configurado
    return { totalUsers: 0, totalTransactions: 0, totalMoneyManaged: 0 }
  }

  try {
    const { data, error } = await publicClient.rpc('get_platform_stats')

    if (error || !data) {
      console.error('Error fetching platform stats:', error)
      return { totalUsers: 0, totalTransactions: 0, totalMoneyManaged: 0 }
    }

    return {
      totalUsers: data.total_users ?? 0,
      totalTransactions: data.total_transactions ?? 0,
      totalMoneyManaged: data.total_money_managed ?? 0,
    }
  } catch (err) {
    console.error('Error fetching platform stats:', err)
    return { totalUsers: 0, totalTransactions: 0, totalMoneyManaged: 0 }
  }
}
