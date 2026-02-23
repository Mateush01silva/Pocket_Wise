import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { NotificationBell } from '../NotificationBell'
import { OnboardingModal } from '../OnboardingModal'
import { useAuth } from '../../contexts/AuthContext'
import { useUserPreferencesStore } from '../../store/useUserPreferencesStore'
import { AlertTriangle } from 'lucide-react'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { subscription, daysUntilExpiration, userProfile } = useAuth()
  const onboardingCompleted = useUserPreferencesStore((s) => s.onboardingCompleted)

  const days = daysUntilExpiration()
  const isAdmin = userProfile?.role === 'admin'

  // Mostrar banner se: trial ou cancelamento pendente, e faltam 7 dias ou menos
  const showWarning = !isAdmin && days >= 0 && days <= 7 && (
    (subscription?.status === 'trial') ||
    (subscription?.status === 'active' && subscription?.cancel_at_period_end)
  )

  const isTrial = subscription?.status === 'trial'

  return (
    <div className="flex min-h-screen bg-dark-900">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Overlay para mobile quando sidebar está aberta */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8">
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

        <div className="max-w-7xl mx-auto pt-14 lg:pt-0">
          {/* Banner de aviso de expiração */}
          {showWarning && (
            <div className={`mb-6 rounded-lg p-3 flex items-center justify-between gap-3 ${
              days <= 2
                ? 'bg-red-500/10 border border-red-500/20'
                : 'bg-yellow-500/10 border border-yellow-500/20'
            }`}>
              <div className="flex items-center gap-3">
                <AlertTriangle size={18} className={days <= 2 ? 'text-red-400' : 'text-yellow-400'} />
                <p className={`text-sm ${days <= 2 ? 'text-red-200' : 'text-yellow-200'}`}>
                  {isTrial ? (
                    days === 0
                      ? 'Seu teste gratuito termina hoje!'
                      : days === 1
                        ? 'Seu teste gratuito termina amanhã!'
                        : `Seu teste gratuito termina em ${days} dias.`
                  ) : (
                    days === 0
                      ? 'Sua assinatura expira hoje!'
                      : days === 1
                        ? 'Sua assinatura expira amanhã!'
                        : `Sua assinatura expira em ${days} dias.`
                  )}
                </p>
              </div>
              <Link
                to={isTrial ? '/app/assinar' : '/app/configuracoes'}
                className={`text-sm font-medium whitespace-nowrap ${
                  days <= 2
                    ? 'text-red-400 hover:text-red-300'
                    : 'text-yellow-400 hover:text-yellow-300'
                }`}
              >
                {isTrial ? 'Assinar agora' : 'Ver detalhes'}
              </Link>
            </div>
          )}

          {children}
        </div>
      </main>

      {/* Onboarding de primeiro acesso */}
      {!onboardingCompleted && <OnboardingModal />}
    </div>
  )
}
