import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

interface PrivateRouteProps {
  children: React.ReactNode
}

const Spinner = () => (
  <div className="flex items-center justify-center min-h-screen bg-dark-900">
    <div className="text-center">
      <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="text-gray-400 text-lg">Carregando...</p>
    </div>
  </div>
)

export function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, loading, hasAccess, subscription, subscriptionLoaded, userProfile } = useAuth()

  // Auth ainda carregando (getSession ainda não terminou)
  if (loading) return <Spinner />

  // Sem sessão → login
  if (!user) return <Navigate to="/login" replace />

  // Admin bypass — não precisa de assinatura
  if (userProfile?.role === 'admin') return <>{children}</>

  // Aguarda fetchSubscription terminar (sucesso ou falha)
  // subscriptionLoaded=true após qualquer tentativa, então o spinner
  // só aparece por instantes — nunca infinitamente
  if (!subscriptionLoaded) return <Spinner />

  // Sem assinatura ou sem acesso → paywall
  if (!subscription || !hasAccess()) return <Navigate to="/app/assinar" replace />

  return <>{children}</>
}
