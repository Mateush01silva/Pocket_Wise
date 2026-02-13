import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, isSupabaseConfigured, clearFamilyIdCache } from '../lib/supabase'
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
  avatar_url: string | null
}

interface AuthContextType {
  user: User | null
  session: Session | null
  subscription: Subscription | null
  userProfile: UserProfile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  refreshSubscription: () => Promise<Subscription | null>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  hasAccess: () => boolean
  trialDaysRemaining: () => number
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Chaves localStorage que devem ser limpas ao trocar de usuário
// Inclui TODOS os stores com persist para evitar vazamento de dados entre contas
const PERSISTED_STORE_KEYS = [
  'pocket-wise-user-preferences',
  'learning-mode-storage',
  'pocketwise-categorias-store',
  'pocketwise-cartoes-store',
  'pocketwise-contas-bancarias-store',
  'pocketwise-orcamentos-store',
  'pocketwise-patrimonio-store',
]

function clearPersistedStores() {
  PERSISTED_STORE_KEYS.forEach((key) => {
    localStorage.removeItem(key)
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const currentUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setLoading(false)
      return
    }

    // 1) Carregar sessão inicial + dados do usuário
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      currentUserIdRef.current = session?.user?.id ?? null

      if (session?.user) {
        try {
          await Promise.all([
            fetchUserProfile(session.user.id),
            fetchSubscription(session.user.id),
          ])
        } catch (e) {
          console.error('Erro ao carregar dados iniciais:', e)
        }
      }
      setLoading(false)
    }).catch(() => {
      // Garantir que loading=false mesmo se getSession falhar
      setLoading(false)
    })

    // 2) Listener de eventos auth - NUNCA setar loading aqui
    // Supabase recomenda que o callback NÃO seja async
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const previousUserId = currentUserIdRef.current
      const newUserId = session?.user?.id ?? null

      // Se mudou de usuário, limpar caches
      if (previousUserId && newUserId && previousUserId !== newUserId) {
        clearPersistedStores()
        clearFamilyIdCache()
      }

      currentUserIdRef.current = newUserId
      setSession(session)
      setUser(session?.user ?? null)

      if (!session?.user) {
        setUserProfile(null)
        setSubscription(null)
      }
    })

    return () => authSubscription.unsubscribe()
  }, [])

  const fetchUserProfile = async (userId: string) => {
    if (!supabase) return

    try {
      const { data, error } = await (supabase as any)
        .from('users')
        .select('id, email, full_name, role, avatar_url')
        .eq('id', userId)
        .single()

      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Erro ao buscar perfil do usuário:', error)
    }
  }

  const fetchSubscription = async (userId: string): Promise<Subscription | null> => {
    if (!supabase) return null

    try {
      const { data, error } = await (supabase as any)
        .from('plano_usuario')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      setSubscription(data)
      return data
    } catch (error) {
      console.error('Erro ao buscar assinatura:', error)
      return null
    }
  }

  const signIn = async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured')

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) throw error

    // Buscar perfil e assinatura ANTES de retornar
    // Assim quando a tela navegar para /app, os dados já estarão prontos
    if (data.user) {
      currentUserIdRef.current = data.user.id
      clearFamilyIdCache()
      await Promise.all([
        fetchUserProfile(data.user.id),
        fetchSubscription(data.user.id),
      ])
    }
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

    // Subscription trial é criada automaticamente via trigger no banco (handle_new_user)
    // O trigger pode demorar alguns ms, então fazemos retry se não encontrar
    if (data.user) {
      currentUserIdRef.current = data.user.id
      await fetchUserProfile(data.user.id)

      // Tentar buscar a subscription com retry (trigger pode não ter executado ainda)
      for (let attempt = 0; attempt < 5; attempt++) {
        const sub = await fetchSubscription(data.user.id)
        if (sub) break
        // Esperar antes de tentar novamente (300ms, 600ms, 900ms, 1200ms)
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
      }
    }
  }

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.id)
    }
  }

  const refreshSubscription = async (): Promise<Subscription | null> => {
    if (user) {
      return await fetchSubscription(user.id)
    }
    return null
  }

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase not configured')

    clearPersistedStores()
    clearFamilyIdCache()
    currentUserIdRef.current = null
    setUserProfile(null)
    setSubscription(null)
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
    refreshProfile,
    refreshSubscription,
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
