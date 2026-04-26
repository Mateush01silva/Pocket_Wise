import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase, isSupabaseConfigured, clearFamilyIdCache } from '../lib/supabase'
import { familyInvitesService } from '../services/familyService'
import type { UserFamilyInfo } from '../services/familyService'
import type { User, Session } from '@supabase/supabase-js'

interface Subscription {
  id: string
  user_id: string
  status: 'trial' | 'active' | 'expired' | 'canceled'
  plan: 'monthly' | 'annual' | null
  tier: 'explorador' | 'planejador' | 'mestre'
  plan_id: string | null
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
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
  subscriptionLoaded: boolean
  userProfile: UserProfile | null
  loading: boolean
  userFamilies: UserFamilyInfo[]
  activeFamilyId: string | null
  personalFamilyId: string | null
  switchFamily: (familyId: string) => Promise<{ success: boolean; error?: string }>
  refreshFamilies: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshSubscription: () => Promise<Subscription | null>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  hasAccess: () => boolean
  isPersonalSubValid: () => boolean
  trialDaysRemaining: () => number
  daysUntilExpiration: () => number
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
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [userFamilies, setUserFamilies] = useState<UserFamilyInfo[]>([])
  const [activeFamilyId, setActiveFamilyId] = useState<string | null>(null)
  const [personalFamilyId, setPersonalFamilyId] = useState<string | null>(null)
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
            fetchUserFamilies(),
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
        setSubscriptionLoaded(false)
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
    if (!supabase) {
      setSubscriptionLoaded(true)
      return null
    }

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
    } finally {
      setSubscriptionLoaded(true)
    }
  }

  const fetchUserFamilies = async () => {
    try {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000))
      const result = await Promise.race([familyInvitesService.getUserFamilies(), timeout])
      if (result) {
        setUserFamilies(result.families)
        setActiveFamilyId(result.activeFamilyId)
        setPersonalFamilyId(result.personalFamilyId)
      }
    } catch (e) {
      console.error('Erro ao buscar famílias do usuário:', e)
    }
  }

  const switchFamily = async (familyId: string) => {
    const result = await familyInvitesService.switchFamily(familyId)
    if (result.success) {
      setActiveFamilyId(familyId)
      // Recarregar dados das famílias para sincronizar
      await fetchUserFamilies()
    }
    return result
  }

  const refreshFamilies = async () => {
    await fetchUserFamilies()
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
      try {
        await Promise.all([
          fetchUserProfile(data.user.id),
          fetchSubscription(data.user.id),
          fetchUserFamilies(),
        ])
      } catch (e) {
        console.error('Erro ao carregar dados pós-login:', e)
      }
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

    // Subscription trial e família são criadas automaticamente via trigger no banco (handle_new_user)
    // O trigger pode demorar alguns ms, então fazemos retry se não encontrar
    if (data.user) {
      currentUserIdRef.current = data.user.id
      clearFamilyIdCache()
      await fetchUserProfile(data.user.id)

      // Tentar buscar a subscription com retry (trigger pode não ter executado ainda)
      for (let attempt = 0; attempt < 5; attempt++) {
        const sub = await fetchSubscription(data.user.id)
        if (sub) break
        // Esperar antes de tentar novamente (300ms, 600ms, 900ms, 1200ms)
        await new Promise(resolve => setTimeout(resolve, 300 * (attempt + 1)))
      }

      // Buscar famílias com retry (trigger pode não ter criado a família ainda)
      // Essencial para que o usuário possa criar caixinhas e transações imediatamente
      for (let attempt = 0; attempt < 5; attempt++) {
        const result = await familyInvitesService.getUserFamilies()
        if (result && result.families.length > 0) {
          setUserFamilies(result.families)
          setActiveFamilyId(result.activeFamilyId)
          setPersonalFamilyId(result.personalFamilyId)
          break
        }
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

  const signInWithGoogle = async () => {
    if (!supabase) throw new Error('Supabase not configured')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    })
    if (error) throw error
    // O navegador redireciona para o Google, então nada mais executa aqui
  }

  const signOut = async () => {
    if (!supabase) throw new Error('Supabase not configured')

    clearPersistedStores()
    clearFamilyIdCache()
    currentUserIdRef.current = null
    setUserProfile(null)
    setSubscription(null)
    setUserFamilies([])
    setActiveFamilyId(null)
    setPersonalFamilyId(null)
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

    // Membros convidados para a família de outra pessoa têm acesso
    // pelo plano do dono da família — não precisam de assinatura própria
    // Fallback por role: se personal_family_id foi incorretamente definido no DB,
    // verificar se o usuário não é admin de nenhuma família (é apenas membro)
    const isInvitedMember = userFamilies.some(f => !f.is_personal) || userFamilies.some(f => f.role !== 'admin')
    if (isInvitedMember) return true

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
      // Se cancelou, manter acesso até o fim do período pago
      if (subscription.cancel_at_period_end && subscription.current_period_end) {
        return new Date(subscription.current_period_end) > new Date()
      }
      return true
    }

    return false
  }

  // Verifica se a assinatura pessoal (própria) do usuário ainda é válida.
  // Não considera acesso via família convidada — usado na troca para conta pessoal.
  const isPersonalSubValid = (): boolean => {
    if (!subscription) return false
    if (subscription.status === 'trial') {
      if (!subscription.trial_ends_at) return false
      return new Date(subscription.trial_ends_at) > new Date()
    }
    if (subscription.status === 'active') {
      if (subscription.cancel_at_period_end && subscription.current_period_end) {
        return new Date(subscription.current_period_end) > new Date()
      }
      return true
    }
    return false
  }

  const daysUntilExpiration = (): number => {
    // Membros convidados não têm data de expiração própria
    const isInvitedMember = userFamilies.some(f => !f.is_personal) || userFamilies.some(f => f.role !== 'admin')
    if (isInvitedMember) return -1

    if (!subscription) return 0

    let endDate: string | null = null

    if (subscription.status === 'trial') {
      endDate = subscription.trial_ends_at
    } else if (subscription.status === 'active' && subscription.cancel_at_period_end) {
      endDate = subscription.current_period_end
    }

    if (!endDate) return -1 // -1 = sem data de expiração (assinatura recorrente ativa)

    const diffMs = new Date(endDate).getTime() - new Date().getTime()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
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
    subscriptionLoaded,
    userProfile,
    loading,
    userFamilies,
    activeFamilyId,
    personalFamilyId,
    switchFamily,
    refreshFamilies,
    refreshProfile,
    refreshSubscription,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    hasAccess,
    isPersonalSubValid,
    trialDaysRemaining,
    daysUntilExpiration,
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
