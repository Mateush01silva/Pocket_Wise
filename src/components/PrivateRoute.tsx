import { useEffect, useState } from 'react'
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
  const { user, loading, hasAccess, subscription, userProfile } = useAuth()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    // Sempre reseta ao mudar dependências
    setTimedOut(false)

    // Se auth finalizou, há usuário, mas subscription não carregou,
    // aguarda até 5s (race condition de login) — depois redireciona para paywall
    if (!loading && user && !subscription) {
      const timer = setTimeout(() => setTimedOut(true), 5000)
      return () => clearTimeout(timer)
    }
  }, [loading, user, subscription])

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />

  // Admin não precisa de validação de assinatura
  if (userProfile?.role === 'admin') return <>{children}</>

  // Aguarda subscription carregar (race condition breve após login)
  // Mas se o timeout expirou, para de esperar e vai para o paywall
  if (!subscription && !timedOut) return <Spinner />

  // Sem assinatura (fetch falhou ou expirado) ou sem acesso → paywall
  if (!subscription || !hasAccess()) return <Navigate to="/app/assinar" replace />

  return <>{children}</>
}
