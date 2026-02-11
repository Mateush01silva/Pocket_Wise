import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface Subscription {
  id: string
  user_id: string
  status: 'trial' | 'active' | 'expired' | 'canceled'
  plan: 'monthly' | 'annual' | null
  trial_ends_at: string | null
  current_period_end: string | null
  created_at: string
}

interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'user' | 'admin'
}

interface AuthContextType {
  user: User | null
  session: Session | null
  subscription: Subscription | null
  userProfile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  hasAccess: () => boolean
  trialDaysRemaining: () => number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Se Supabase não está configurado, setar loading false e return
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
        fetchSubscription(session.user.id)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        fetchUserProfile(session.user.id)
        fetchSubscription(session.user.id)
      } else {
        setUserProfile(null)
        setSubscription(null)
      }
    })

    return () => authSubscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Erro ao buscar perfil do usuário:', error)
    }
  }

  const fetchSubscription = async (userId: string) => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('plano_usuario')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      setSubscription(data)
    } catch (error) {
      console.error('Erro ao buscar assinatura:', error)
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error
  }

  const signUp = async (email: string, password: string, name: string) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    })

    if (error) throw error

    // Subscription trial será criada automaticamente via trigger no banco
    if (data.user) {
      await fetchUserProfile(data.user.id)
      await fetchSubscription(data.user.id)
    }
  }

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    if (error) throw error
  }

  const hasAccess = (): boolean => {
    // Admins têm acesso ilimitado
    if (userProfile?.role === 'admin') {
      return true
    }

    if (!subscription) return false

    // Se está em trial, verificar se ainda não expirou
    if (subscription.status === 'trial') {
      if (!subscription.trial_ends_at) return false
      const trialEnd = new Date(subscription.trial_ends_at)
      const now = new Date()
      return trialEnd > now
    }

    // Se tem assinatura ativa
    if (subscription.status === 'active') {
      return true
    }

    return false
  }

  const trialDaysRemaining = (): number => {
    if (!subscription || subscription.status !== 'trial' || !subscription.trial_ends_at) {
      return 0
    }

    const trialEnd = new Date(subscription.trial_ends_at)
    const now = new Date()
    const diffTime = trialEnd.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return Math.max(0, diffDays)
  }

  const value = {
    user,
    session,
    subscription,
    userProfile,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    hasAccess,
    trialDaysRemaining,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
