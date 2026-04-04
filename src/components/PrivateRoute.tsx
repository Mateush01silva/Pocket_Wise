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
  const { user, loading, hasAccess, subscription } = useAuth()

  if (loading) return <Spinner />

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Usuário autenticado mas subscription ainda não carregou (race condition
  // entre onAuthStateChange e fetchSubscription após login) — aguardar.
  if (!subscription) return <Spinner />

  if (!hasAccess()) {
    return <Navigate to="/app/assinar" replace />
  }

  return <>{children}</>
}
