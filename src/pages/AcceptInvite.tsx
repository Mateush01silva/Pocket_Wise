import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { Users, Mail, Check, X, UserPlus, AlertCircle, Clock, Shield } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { useFamilyStore } from '../store/useFamilyStore'
import { familyInvitesService } from '../services/familyService'
import { useAuth } from '../contexts/AuthContext'
import type { FamilyInviteWithDetails } from '../types'
import { toast } from 'sonner'

export function AcceptInvite() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [invite, setInvite] = useState<FamilyInviteWithDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const acceptInvite = useFamilyStore((state) => state.acceptInvite)
  const rejectInvite = useFamilyStore((state) => state.rejectInvite)
  const storeError = useFamilyStore((state) => state.error)

  // Carregar convite ao montar
  useEffect(() => {
    loadInvite()
  }, [token])

  const loadInvite = async () => {
    if (!token) {
      setError('Token de convite inválido')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { data, error } = await familyInvitesService.getInviteByToken(token)

      if (error || !data) {
        setError(error?.message || 'Convite não encontrado')
        setInvite(null)
      } else {
        setInvite(data)
      }
    } catch (err) {
      console.error('Erro ao carregar convite:', err)
      setError('Erro ao carregar convite. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!token) return

    setIsAccepting(true)

    try {
      const success = await acceptInvite(token)

      if (success) {
        toast.success('Convite aceito! Bem-vindo à família!')
        // Reload completo para que o AuthContext recarregue userFamilies
        // e o FamilySwitcher apareça com as duas famílias disponíveis
        setTimeout(() => {
          window.location.href = '/app/familia'
        }, 1500)
      } else {
        const msg = storeError || 'Erro desconhecido'
        console.error('[AcceptInvite] falhou:', msg)
        toast.error(`Erro ao aceitar convite: ${msg}`)
      }
    } catch (err) {
      console.error('[AcceptInvite] exceção:', err)
      toast.error('Erro ao aceitar convite. Tente novamente.')
    } finally {
      setIsAccepting(false)
    }
  }

  const handleReject = async () => {
    if (!token) return

    setIsRejecting(true)

    try {
      const success = await rejectInvite(token)

      if (success) {
        toast.success('Convite rejeitado')
        setTimeout(() => {
          navigate('/app')
        }, 1500)
      } else {
        toast.error('Erro ao rejeitar convite. Tente novamente.')
      }
    } catch (err) {
      console.error('Erro ao rejeitar convite:', err)
      toast.error('Erro ao rejeitar convite. Tente novamente.')
    } finally {
      setIsRejecting(false)
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrador'
      case 'editor':
        return 'Editor'
      case 'viewer':
        return 'Visualizador'
      default:
        return role
    }
  }

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Controle total da família, incluindo gerenciar membros e convites'
      case 'editor':
        return 'Pode criar, editar e deletar transações, categorias e cartões'
      case 'viewer':
        return 'Pode visualizar todas as informações, mas não pode editar'
      default:
        return ''
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            <p className="text-gray-400">Carregando convite...</p>
          </div>
        </Card>
      </div>
    )
  }

  // Error state
  if (error || !invite) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full p-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-200 mb-2">Convite Inválido</h2>
              <p className="text-gray-400">{error}</p>
            </div>
            <div className="flex flex-col gap-2 w-full mt-4">
              <Button onClick={loadInvite} variant="primary" className="w-full">
                Tentar Novamente
              </Button>
              <Link to="/login">
                <Button variant="ghost" className="w-full">
                  Ir para Login
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  // Verificar se o usuário está logado
  if (!user) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary-500/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-100 mb-2">Convite para Família</h1>
            <p className="text-gray-400">
              Você foi convidado para participar da família financeira
            </p>
          </div>

          {/* Invite Details */}
          <div className="space-y-4 mb-8">
            <div className="p-4 bg-dark-700/50 border border-dark-600 rounded-lg">
              <div className="flex items-center gap-3 mb-3">
                <Users className="w-5 h-5 text-primary-400" />
                <div>
                  <p className="text-sm text-gray-400">Família</p>
                  <p className="text-lg font-semibold text-gray-200">{invite.family_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <UserPlus className="w-5 h-5 text-blue-400" />
                <div>
                  <p className="text-sm text-gray-400">Convidado por</p>
                  <p className="text-gray-200">{invite.invited_by_name}</p>
                  <p className="text-xs text-gray-500">{invite.invited_by_email}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-dark-700/50 border border-dark-600 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Shield className="w-5 h-5 text-green-400" />
                <div>
                  <p className="text-sm text-gray-400">Sua permissão</p>
                  <p className="font-semibold text-gray-200">{getRoleLabel(invite.role)}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 ml-8">{getRoleDescription(invite.role)}</p>
            </div>

            {invite.message && (
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-gray-400 mb-1">Mensagem do convidador:</p>
                <p className="text-gray-300">{invite.message}</p>
              </div>
            )}
          </div>

          {/* Auth Required Message */}
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-6">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-300 mb-1">Login Necessário</p>
                <p className="text-gray-400">
                  Para aceitar este convite, você precisa fazer login ou criar uma conta usando o
                  email <span className="font-medium text-gray-300">{invite.invited_email}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to={`/login?redirect=/convite/${token}`} className="flex-1">
              <Button variant="secondary" className="w-full">
                Já tenho conta
              </Button>
            </Link>
            <Link to={`/cadastro?redirect=/convite/${token}&email=${invite.invited_email}`} className="flex-1">
              <Button variant="primary" className="w-full">
                <UserPlus className="w-4 h-4 mr-2" />
                Criar Conta e Aceitar
              </Button>
            </Link>
          </div>

          {/* Expiration Notice */}
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-6">
            <Clock className="w-4 h-4" />
            <span>
              Este convite expira em{' '}
              {new Date(invite.expires_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </Card>
      </div>
    )
  }

  // Usuário está logado - mostrar opções de aceitar/rejeitar
  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary-500/10 flex items-center justify-center mb-4">
            <Users className="w-8 h-8 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Convite para Família</h1>
          <p className="text-gray-400">Você deseja aceitar este convite?</p>
        </div>

        {/* Invite Details */}
        <div className="space-y-4 mb-8">
          <div className="p-4 bg-dark-700/50 border border-dark-600 rounded-lg">
            <div className="flex items-center gap-3 mb-3">
              <Users className="w-5 h-5 text-primary-400" />
              <div>
                <p className="text-sm text-gray-400">Família</p>
                <p className="text-lg font-semibold text-gray-200">{invite.family_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <UserPlus className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-sm text-gray-400">Convidado por</p>
                <p className="text-gray-200">{invite.invited_by_name}</p>
                <p className="text-xs text-gray-500">{invite.invited_by_email}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-dark-700/50 border border-dark-600 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Mail className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-sm text-gray-400">Email do convite</p>
                <p className="text-gray-200">{invite.invited_email}</p>
              </div>
            </div>
          </div>

          <div className="p-4 bg-dark-700/50 border border-dark-600 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="w-5 h-5 text-green-400" />
              <div>
                <p className="text-sm text-gray-400">Sua permissão</p>
                <p className="font-semibold text-gray-200">{getRoleLabel(invite.role)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 ml-8">{getRoleDescription(invite.role)}</p>
          </div>

          {invite.message && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-gray-400 mb-1">Mensagem do convidador:</p>
              <p className="text-gray-300">{invite.message}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="ghost"
            onClick={handleReject}
            isLoading={isRejecting}
            disabled={isAccepting}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            Rejeitar
          </Button>
          <Button
            variant="primary"
            onClick={handleAccept}
            isLoading={isAccepting}
            disabled={isRejecting}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            Aceitar Convite
          </Button>
        </div>

        {/* Expiration Notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-6">
          <Clock className="w-4 h-4" />
          <span>
            Este convite expira em{' '}
            {new Date(invite.expires_at).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
      </Card>
    </div>
  )
}
