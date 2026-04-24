import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Sidebar } from './Sidebar'
import { NotificationBell } from '../NotificationBell'
import { OnboardingModal } from '../OnboardingModal'
import { PushPermissionBanner } from '../PushPermissionBanner'
import { TrialExpiredModal } from '../TrialExpiredModal'
import { useAuth } from '../../contexts/AuthContext'
import { useUserPreferencesStore } from '../../store/useUserPreferencesStore'
import { usePlan } from '../../hooks/usePlan'
import { AlertTriangle, Zap, Briefcase, ChevronLeft } from 'lucide-react'
import { useFamilyStore } from '../../store/useFamilyStore'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(
    () => localStorage.getItem('pw-sidebar-collapsed') === '1'
  )

  const handleToggleCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('pw-sidebar-collapsed', next ? '1' : '0')
      return next
    })
  }
  const { user, subscription, daysUntilExpiration, userProfile, switchFamily, personalFamilyId } = useAuth()
  const { trialDaysLeft, isTrialExpired } = usePlan()
  const onboardingCompletedInStore = useUserPreferencesStore((s) => s.onboardingCompleted)
  const navigate = useNavigate()

  // Detectar modo consultor
  const familyMembers = useFamilyStore((state) => state.members)
  const refresh = useFamilyStore((state) => state.refresh)
  const currentMember = familyMembers.find((m) => m.user_id === (user?.id || ''))
  const isConsultorMode = currentMember?.member_type === 'consultor'
  const family = useFamilyStore((state) => state.family)

  const handleBackToClients = async () => {
    if (personalFamilyId) {
      await switchFamily(personalFamilyId)
      await refresh()
    }
    navigate('/app/meus-clientes')
  }

  // Onboarding é persistido por usuário em uma chave separada que não é apagada no logout.
  const onboardingCompleted = user
    ? localStorage.getItem(`pw-onboarding-done-${user.id}`) === '1' || onboardingCompletedInStore
    : onboardingCompletedInStore

  const days = daysUntilExpiration()
  const isAdmin = userProfile?.role === 'admin'
  const isTrial = subscription?.status === 'trial'

  // Consultores usam o plano do cliente — suprimir todos os banners/modais de assinatura
  const showTrialBanner = !isAdmin && !isConsultorMode && isTrial && !isTrialExpired

  const showSubscriptionWarning = !isAdmin && !isConsultorMode && !isTrial && days >= 0 && days <= 7 && (
    subscription?.status === 'active' && subscription?.cancel_at_period_end
  )

  const showTrialExpiredModal = !isAdmin && !isConsultorMode && isTrial && isTrialExpired

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Overlay para mobile quando sidebar está aberta */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className={cn("flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8 transition-all duration-300", isSidebarCollapsed ? "lg:ml-16" : "lg:ml-64")}>
        {/* Header fixo com botão hambúrguer e notificações */}
        <div className="fixed top-4 left-4 right-4 z-30 flex items-center justify-between lg:left-auto lg:right-8">
          {/* Botão hambúrguer para mobile */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 rounded-lg bg-dark-800 border border-dark-700 hover:bg-dark-700 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isSidebarOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>

          {/* Notificações */}
          <NotificationBell />
        </div>

        <div className="max-w-7xl mx-auto pt-14 lg:pt-0 overflow-x-hidden">
          {/* Banner trial Explorador — exibido durante todo o período de trial */}
          {showTrialBanner && (
            <div className={cn(
              'mb-6 rounded-lg p-3 flex items-center justify-between gap-3',
              trialDaysLeft <= 3
                ? 'bg-orange-500/10 border border-orange-500/20'
                : 'bg-primary-500/10 border border-primary-500/20'
            )}>
              <div className="flex items-center gap-3 min-w-0">
                {trialDaysLeft <= 3 ? (
                  <AlertTriangle size={18} className="text-orange-400 shrink-0" />
                ) : (
                  <Zap size={18} className="text-primary-400 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className={cn('text-sm', trialDaysLeft <= 3 ? 'text-orange-200' : 'text-primary-200')}>
                    {trialDaysLeft === 0
                      ? 'Seu período Explorador termina hoje!'
                      : trialDaysLeft === 1
                        ? 'Seu período Explorador termina amanhã!'
                        : `Explorador: ${trialDaysLeft} dias restantes`}
                    {trialDaysLeft <= 3 && ' — não perca seu progresso!'}
                  </p>
                  {/* Barra de progresso dos 14 dias */}
                  <div className="mt-1.5 h-1 w-40 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', trialDaysLeft <= 3 ? 'bg-orange-400' : 'bg-primary-400')}
                      style={{ width: `${Math.max(0, ((14 - trialDaysLeft) / 14) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
              <Link
                to="/app/assinatura"
                className={cn(
                  'text-sm font-medium whitespace-nowrap shrink-0',
                  trialDaysLeft <= 3 ? 'text-orange-400 hover:text-orange-300' : 'text-primary-400 hover:text-primary-300'
                )}
              >
                Assinar agora
              </Link>
            </div>
          )}

          {/* Banner de cancelamento pendente de assinatura paga */}
          {showSubscriptionWarning && (
            <div className={cn(
              'mb-6 rounded-lg p-3 flex items-center justify-between gap-3',
              days <= 2 ? 'bg-red-500/10 border border-red-500/20' : 'bg-yellow-500/10 border border-yellow-500/20'
            )}>
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className={days <= 2 ? 'text-red-400' : 'text-yellow-400'} />
                <p className={cn('text-sm', days <= 2 ? 'text-red-200' : 'text-yellow-200')}>
                  {days === 0
                    ? 'Sua assinatura expira hoje!'
                    : days === 1
                      ? 'Sua assinatura expira amanhã!'
                      : `Sua assinatura expira em ${days} dias.`}
                </p>
              </div>
              <Link
                to="/app/assinatura"
                className={cn('text-sm font-medium whitespace-nowrap', days <= 2 ? 'text-red-400 hover:text-red-300' : 'text-yellow-400 hover:text-yellow-300')}
              >
                Ver planos
              </Link>
            </div>
          )}

          {/* Banner de modo consultor */}
          {isConsultorMode && (
            <div className="mb-6 rounded-lg p-3 flex items-center justify-between gap-3 bg-primary-500/10 border border-primary-500/20">
              <div className="flex items-center gap-3 min-w-0">
                <Briefcase size={16} className="text-primary-400 shrink-0" />
                <p className="text-sm text-primary-200 truncate">
                  Visualizando{' '}
                  <span className="font-medium text-primary-100">{family?.nome || 'um cliente'}</span>
                  {' '}como consultor
                </p>
              </div>
              <button
                onClick={handleBackToClients}
                className="flex items-center gap-1 text-sm font-medium text-primary-400 hover:text-primary-300 whitespace-nowrap shrink-0 transition-colors"
              >
                <ChevronLeft size={14} />
                Meus Clientes
              </button>
            </div>
          )}

          {children}
        </div>
      </main>

      {/* Onboarding de primeiro acesso */}
      {!onboardingCompleted && <OnboardingModal />}

      {/* Modal bloqueante quando trial expira */}
      {showTrialExpiredModal && <TrialExpiredModal />}

      {/* Banner de permissão push — aparece após 3 visitas, de forma não intrusiva */}
      <PushPermissionBanner />
    </div>
  )
}
