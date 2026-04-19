import { useAuth } from '../contexts/AuthContext'

export type Tier = 'explorador' | 'planejador' | 'mestre'
export type FeatureAccess = 'full' | 'limited' | 'preview' | 'locked'

export type Feature =
  | 'dashboard'
  | 'transactions'
  | 'categories'
  | 'cards'
  | 'accounts'
  | 'envelopes'
  | 'caixinhas'
  | 'rebalancing'
  | 'posso_comprar_sim'
  | 'cashflow'
  | 'reports'
  | 'family'
  | 'pocks'
  | 'ai_assistant'
  | 'posso_comprar_ai'
  | 'ai_personalities'
  | 'verificar_fatura'

export type LimitedResource = 'transactions' | 'cards' | 'accounts' | 'envelopes' | 'caixinhas'

const FEATURE_ACCESS: Record<Feature, Record<Tier, FeatureAccess>> = {
  dashboard:         { explorador: 'full',    planejador: 'full',    mestre: 'full' },
  transactions:      { explorador: 'limited', planejador: 'full',    mestre: 'full' },
  categories:        { explorador: 'full',    planejador: 'full',    mestre: 'full' },
  cards:             { explorador: 'limited', planejador: 'full',    mestre: 'full' },
  accounts:          { explorador: 'limited', planejador: 'full',    mestre: 'full' },
  envelopes:         { explorador: 'limited', planejador: 'full',    mestre: 'full' },
  caixinhas:         { explorador: 'limited', planejador: 'full',    mestre: 'full' },
  rebalancing:       { explorador: 'full',    planejador: 'full',    mestre: 'full' },
  posso_comprar_sim: { explorador: 'full',    planejador: 'full',    mestre: 'full' },
  cashflow:          { explorador: 'preview', planejador: 'full',    mestre: 'full' },
  reports:           { explorador: 'preview', planejador: 'full',    mestre: 'full' },
  family:            { explorador: 'preview', planejador: 'full',    mestre: 'full' },
  pocks:             { explorador: 'preview', planejador: 'locked',  mestre: 'full' },
  ai_assistant:      { explorador: 'locked',  planejador: 'locked',  mestre: 'full' },
  posso_comprar_ai:  { explorador: 'locked',  planejador: 'locked',  mestre: 'full' },
  ai_personalities:  { explorador: 'locked',  planejador: 'locked',  mestre: 'full' },
  verificar_fatura:  { explorador: 'locked',  planejador: 'locked',  mestre: 'full' },
} as const

const TIER_LIMITS: Record<Tier, Record<LimitedResource, number>> = {
  explorador: { transactions: 20, cards: 1, accounts: 1, envelopes: 5, caixinhas: 2 },
  planejador: { transactions: Infinity, cards: Infinity, accounts: Infinity, envelopes: Infinity, caixinhas: Infinity },
  mestre:     { transactions: Infinity, cards: Infinity, accounts: Infinity, envelopes: Infinity, caixinhas: Infinity },
}

export interface UsePlanReturn {
  tier: Tier
  isTrialExpired: boolean
  trialDaysLeft: number
  featureAccess: (feature: Feature) => FeatureAccess
  canAccess: (feature: Feature) => boolean
  getLimit: (resource: LimitedResource) => number
}

export function usePlan(): UsePlanReturn {
  const { subscription, userProfile, userFamilies } = useAuth()

  // Determinar tier efetivo
  const tier: Tier = (() => {
    // Admins têm tier mestre
    if (userProfile?.role === 'admin') return 'mestre'

    // Membros convidados (não são dono da família) herdam acesso mestre
    const isInvitedMember = userFamilies.some(f => !f.is_personal)
    if (isInvitedMember) return 'mestre'

    // Tier do DB (definido na migration 050 e pelo create-checkout)
    if (subscription?.tier) return subscription.tier

    // Fallback
    return 'explorador'
  })()

  const isTrialExpired = (() => {
    if (!subscription) return false
    if (subscription.status !== 'trial') return false
    if (!subscription.trial_ends_at) return true
    return new Date(subscription.trial_ends_at) <= new Date()
  })()

  const trialDaysLeft = (() => {
    if (!subscription?.trial_ends_at) return 0
    if (subscription.status !== 'trial') return 0
    const diffMs = new Date(subscription.trial_ends_at).getTime() - Date.now()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
  })()

  const featureAccess = (feature: Feature): FeatureAccess => {
    return FEATURE_ACCESS[feature][tier]
  }

  const canAccess = (feature: Feature): boolean => {
    const access = featureAccess(feature)
    return access === 'full' || access === 'limited' || access === 'preview'
  }

  const getLimit = (resource: LimitedResource): number => {
    return TIER_LIMITS[tier][resource]
  }

  return { tier, isTrialExpired, trialDaysLeft, featureAccess, canAccess, getLimit }
}
