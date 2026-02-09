import { useMemo, useState, useEffect } from 'react'
import {
  Users,
  UserPlus,
  CreditCard,
  Shield,
  Mail,
  Trash2,
  Crown,
  Eye,
  Edit3,
  Clock,
  X,
  Check,
  Pencil,
  Flame,
  CalendarCheck,
  ListChecks,
  Tags,
  DollarSign,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Button } from '../components/ui'
import {
  useTransacoesStore,
  useCartoesStore,
  useOrcamentosStore,
  useCategoriasStore,
} from '../store'
import { useFamilyStore } from '../store/useFamilyStore'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '../utils/currency'
import { differenceInDays, parseISO } from 'date-fns'
import { FamilyInviteModal } from '../components/FamilyInviteModal'
import { toast } from 'sonner'
import type { OrcamentoMensal } from '../types'

export function Family() {
  const { user } = useAuth()
  const lancamentos = useTransacoesStore((state) => state.lancamentos)
  const cartoes = useCartoesStore((state) => state.cartoes)
  const orcamentos = useOrcamentosStore((state) => state.orcamentos) as OrcamentoMensal[]
  const categorias = useCategoriasStore((state) => state.categorias)

  // Family store
  const {
    family,
    members,
    invites,
    isLoadingMembers,
    initialize,
    deleteInvite,
    removeMember,
    updateFamily,
    isAdmin,
  } = useFamilyStore()

  // Modal states
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)

  // Edit family name states
  const [isEditingName, setIsEditingName] = useState(false)
  const [editedName, setEditedName] = useState('')

  // Inicializar ao montar
  useEffect(() => {
    initialize()
  }, [initialize])

  // Verificar se o usuário é admin
  const currentUserIsAdmin = user ? isAdmin(user.id) : false

  // Estatísticas da família
  const estatisticas = useMemo(() => {
    // Contadores
    const totalCartoes = cartoes.filter(c => c.ativo).length
    const totalCategorias = categorias.length
    const totalOrcamentos = orcamentos.length
    const totalLancamentos = lancamentos.length

    // Dias usando o sistema (desde a primeira transação)
    let diasUsando = 0
    if (lancamentos.length > 0) {
      const datasOrdenadas = lancamentos
        .map((l) => parseISO(l.created_at))
        .sort((a, b) => a.getTime() - b.getTime())
      diasUsando = differenceInDays(new Date(), datasOrdenadas[0]) + 1
    }

    // Total já controlado (soma absoluta de todas transações)
    const totalControlado = lancamentos.reduce((sum, l) => sum + l.valor, 0)

    return {
      totalCartoes,
      totalCategorias,
      totalOrcamentos,
      totalLancamentos,
      diasUsando,
      totalControlado,
    }
  }, [lancamentos, cartoes, orcamentos, categorias])

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm('Deseja realmente cancelar este convite?')) return

    const success = await deleteInvite(inviteId)
    if (success) {
      toast.success('Convite cancelado')
    } else {
      toast.error('Erro ao cancelar convite')
    }
  }

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Deseja realmente remover ${memberName} da família?`)) return

    const success = await removeMember(memberId)
    if (success) {
      toast.success(`${memberName} foi removido da família`)
    } else {
      toast.error('Erro ao remover membro')
    }
  }

  const handleStartEditName = () => {
    if (family) {
      setEditedName(family.nome)
      setIsEditingName(true)
    }
  }

  const handleCancelEditName = () => {
    setIsEditingName(false)
    setEditedName('')
  }

  const handleSaveEditName = async () => {
    if (!editedName.trim()) {
      toast.error('O nome da família não pode estar vazio')
      return
    }

    const result = await updateFamily(editedName.trim())
    if (result) {
      toast.success('Nome da família atualizado com sucesso')
      setIsEditingName(false)
    } else {
      toast.error('Erro ao atualizar nome da família')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="w-4 h-4" />
      case 'editor':
        return <Edit3 className="w-4 h-4" />
      case 'viewer':
        return <Eye className="w-4 h-4" />
      default:
        return null
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin'
      case 'editor':
        return 'Editor'
      case 'viewer':
        return 'Visualizador'
      default:
        return role
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'text-yellow-400 bg-yellow-500/10'
      case 'editor':
        return 'text-blue-400 bg-blue-500/10'
      case 'viewer':
        return 'text-gray-400 bg-gray-500/10'
      default:
        return 'text-gray-400 bg-gray-500/10'
    }
  }

  return (
    <>
      <FamilyInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        familyId={family?.id || ''}
      />

      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-100 mb-2">Família</h1>
          <p className="text-gray-400">Gerencie membros e compartilhamento financeiro</p>
          {family && (
            <div className="mt-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary-400" />
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEditName()
                      if (e.key === 'Escape') handleCancelEditName()
                    }}
                    className="text-sm bg-dark-700 border border-primary-500 rounded px-2 py-1 text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Nome da família"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveEditName}
                    className="text-green-400 hover:text-green-300 transition-colors"
                    title="Salvar"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleCancelEditName}
                    className="text-red-400 hover:text-red-300 transition-colors"
                    title="Cancelar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-gray-300">Família: {family.nome}</span>
                  {currentUserIsAdmin && (
                    <button
                      onClick={handleStartEditName}
                      className="text-gray-400 hover:text-primary-400 transition-colors"
                      title="Editar nome da família"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          )}
        </div>

      {/* Sua Jornada Financeira */}
      <div>
        <h2 className="text-xl font-bold text-gray-100 mb-4">
          Sua Jornada Financeira
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Dias organizando</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {estatisticas.diasUsando}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {estatisticas.diasUsando >= 30
                      ? 'Continue assim!'
                      : 'O hábito se forma com constância'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-orange-500/10 rounded-full flex items-center justify-center">
                  <Flame className="text-orange-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Total controlado</p>
                  <p className="text-2xl font-bold text-primary-400">
                    {formatCurrency(estatisticas.totalControlado)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    em movimentações registradas
                  </p>
                </div>
                <div className="w-12 h-12 bg-primary-500/10 rounded-full flex items-center justify-center">
                  <DollarSign className="text-primary-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Transações</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {estatisticas.totalLancamentos}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    registradas no sistema
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center">
                  <ListChecks className="text-blue-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Meses planejados</p>
                  <p className="text-2xl font-bold text-green-400">
                    {estatisticas.totalOrcamentos}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    orçamentos criados
                  </p>
                </div>
                <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                  <CalendarCheck className="text-green-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Categorias</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {estatisticas.totalCategorias}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    organizando seus gastos
                  </p>
                </div>
                <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center">
                  <Tags className="text-purple-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Cartões</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {estatisticas.totalCartoes}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    sendo monitorados
                  </p>
                </div>
                <div className="w-12 h-12 bg-yellow-500/10 rounded-full flex items-center justify-center">
                  <CreditCard className="text-yellow-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

        {/* Convites Pendentes */}
        {currentUserIsAdmin && invites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Convites Pendentes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {invites
                  .filter((invite) => invite.status === 'pending')
                  .map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center justify-between p-4 bg-dark-700/30 rounded-lg border border-dark-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center">
                          <Mail className="text-blue-400" size={20} />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-200">{invite.invited_email}</h4>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <Clock size={12} />
                            <span>
                              Expira em{' '}
                              {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${getRoleColor(
                            invite.role
                          )}`}
                        >
                          {getRoleIcon(invite.role)}
                          {getRoleLabel(invite.role)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteInvite(invite.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Membros da Família */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Membros da Família</CardTitle>
              {currentUserIsAdmin && (
                <Button onClick={() => setIsInviteModalOpen(true)}>
                  <UserPlus size={16} className="mr-2" />
                  Convidar Membro
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingMembers ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto"></div>
                <p className="text-gray-400 mt-2">Carregando membros...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-gray-500 border-2 border-dashed border-dark-700 rounded-lg">
                <Users className="mx-auto mb-3 text-gray-600" size={32} />
                <p className="mb-2">Nenhum membro na família</p>
                <p className="text-sm text-gray-600">
                  Convide membros para compartilhar o controle financeiro
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member) => {
                  const isCurrentUser = member.user_id === user?.id
                  const canRemove = currentUserIsAdmin && !isCurrentUser

                  return (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 bg-dark-700/30 rounded-lg border border-dark-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                          <Users className="text-primary-500" size={24} />
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-200">
                            {member.user_name}
                            {isCurrentUser && (
                              <span className="text-sm text-gray-400 ml-2">(Você)</span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-500">{member.user_email}</p>
                          <p className="text-xs text-gray-600">
                            Membro desde{' '}
                            {new Date(member.joined_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded flex items-center gap-1 ${getRoleColor(
                            member.role
                          )}`}
                        >
                          {getRoleIcon(member.role)}
                          {getRoleLabel(member.role)}
                        </span>
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.user_name)}
                          >
                            <X size={16} />
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
