import { useState, useEffect, useCallback } from 'react'
import { Briefcase, UserPlus, Clock, Copy, Check, X, Settings, User, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from './ui'
import { Button } from './ui/Button'
import { ConsultorInviteModal } from './ConsultorInviteModal'
import { ConsultorPermissionsModal } from './ConsultorPermissionsModal'
import { consultorService } from '../services/consultorService'
import { familyInvitesService } from '../services/familyService'
import { toast } from 'sonner'
import type {
  FamilyInviteWithDetails,
  FamilyMemberWithUser,
  ConsultorPermissionsWithDetails,
  ConsultorPermissionsInput,
} from '../types'

interface ConsultorSectionProps {
  familyId: string
  isAdmin: boolean
  members: FamilyMemberWithUser[]
  invites: FamilyInviteWithDetails[]
  onRefresh: () => void
}

export function ConsultorSection({
  familyId,
  isAdmin,
  members,
  invites,
  onRefresh,
}: ConsultorSectionProps) {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false)
  const [consultorPermissions, setConsultorPermissions] =
    useState<ConsultorPermissionsWithDetails | null>(null)
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(false)
  const [copied, setCopied] = useState(false)

  const consultorMember = members.find((m) => m.member_type === 'consultor')
  const consultorPendingInvite = invites.find(
    (i) => i.member_type === 'consultor' && i.status === 'pending'
  )

  const loadPermissions = useCallback(async () => {
    if (!consultorMember || !familyId) return
    setIsLoadingPermissions(true)
    const { data } = await consultorService.getConsultorPermissions(familyId)
    setConsultorPermissions(data)
    setIsLoadingPermissions(false)
  }, [consultorMember, familyId])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const handleCancelInvite = async () => {
    if (!consultorPendingInvite) return
    if (!confirm('Deseja cancelar o convite de consultor?')) return

    const { data, error } = await familyInvitesService.deleteInvite(consultorPendingInvite.id)
    if (error || !data) {
      toast.error('Erro ao cancelar convite')
      return
    }
    toast.success('Convite cancelado')
    onRefresh()
  }

  const handleRemoveConsultor = async () => {
    if (!consultorMember) return
    if (!confirm(`Deseja remover ${consultorMember.user_name} como consultor?`)) return

    const { familyMembersService } = await import('../services/familyService')
    const { data, error } = await familyMembersService.removeMember(consultorMember.id)
    if (error || !data) {
      toast.error('Erro ao remover consultor')
      return
    }
    toast.success('Consultor removido')
    setConsultorPermissions(null)
    onRefresh()
  }

  const handleCopyPendingLink = async () => {
    if (!consultorPendingInvite) return
    const link = `${window.location.origin}/convite/${consultorPendingInvite.token}`
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar link')
    }
  }

  const handlePermissionsSaved = (updated: ConsultorPermissionsInput) => {
    if (!consultorPermissions) return
    setConsultorPermissions({ ...consultorPermissions, ...updated })
  }

  const getProfileLabel = (preset?: string | null) => {
    if (preset === 'configurador') return 'Configurador'
    if (preset === 'acompanhador') return 'Acompanhador'
    return 'Personalizado'
  }

  return (
    <>
      {/* Modais */}
      <ConsultorInviteModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false)
          onRefresh()
        }}
        familyId={familyId}
      />

      {consultorPermissions && (
        <ConsultorPermissionsModal
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          permissions={consultorPermissions}
          onSave={handlePermissionsSaved}
        />
      )}

      {/* Seção */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-primary-400" />
              <CardTitle>Consultor Financeiro</CardTitle>
            </div>
            {isAdmin && !consultorMember && !consultorPendingInvite && (
              <Button onClick={() => setIsInviteModalOpen(true)} size="sm">
                <UserPlus size={16} className="mr-2" />
                Convidar Consultor
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Estado: nenhum consultor e sem convite pendente */}
          {!consultorMember && !consultorPendingInvite && (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed border-dark-700 rounded-lg">
              <Briefcase className="mx-auto mb-3 text-gray-600" size={32} />
              <p className="mb-1">Nenhum consultor vinculado</p>
              <p className="text-sm text-gray-600">
                {isAdmin
                  ? 'Convide um consultor para acompanhar suas finanças com permissões controladas.'
                  : 'O administrador pode adicionar um consultor financeiro à conta.'}
              </p>
              {isAdmin && (
                <Button
                  onClick={() => setIsInviteModalOpen(true)}
                  className="mt-4"
                  variant="secondary"
                  size="sm"
                >
                  <UserPlus size={16} className="mr-2" />
                  Convidar Consultor
                </Button>
              )}
            </div>
          )}

          {/* Estado: convite pendente */}
          {consultorPendingInvite && !consultorMember && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center shrink-0">
                    <Clock className="text-yellow-400" size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-200 truncate">
                      {consultorPendingInvite.invited_email}
                    </p>
                    <p className="text-xs text-yellow-400">
                      Convite enviado — aguardando aceite
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Expira em {new Date(consultorPendingInvite.expires_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPendingLink}
                      title="Copiar link novamente"
                    >
                      {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelInvite}
                      title="Cancelar convite"
                    >
                      <X size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Estado: consultor ativo */}
          {consultorMember && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-dark-700/30 rounded-lg border border-dark-600">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary-500/20 rounded-full flex items-center justify-center">
                    <User className="text-primary-400" size={24} />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-200">{consultorMember.user_name}</h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs px-2 py-0.5 bg-primary-500/10 text-primary-400 rounded-full border border-primary-500/20">
                        Consultor
                      </span>
                      {!isLoadingPermissions && consultorPermissions && (
                        <span className="text-xs text-gray-500">
                          Perfil: {getProfileLabel(consultorPermissions.profile_preset)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Membro desde {new Date(consultorMember.joined_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setIsPermissionsModalOpen(true)}
                      disabled={isLoadingPermissions || !consultorPermissions}
                      title="Editar permissões"
                    >
                      <Settings size={16} className="mr-1" />
                      Permissões
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveConsultor}
                      title="Remover consultor"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                )}
              </div>

              {/* Resumo de permissões ativas */}
              {!isLoadingPermissions && consultorPermissions && (
                <div className="p-3 bg-dark-700/20 rounded-lg border border-dark-700">
                  <p className="text-xs font-medium text-gray-400 mb-2">Permissões ativas:</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'can_create_envelopes', label: 'Criar envelopes' },
                      { key: 'can_create_categories', label: 'Criar categorias' },
                      { key: 'can_manage_accounts', label: 'Gerenciar contas' },
                      { key: 'can_view_envelopes', label: 'Ver envelopes' },
                      { key: 'can_view_pocks', label: 'Ver Pocks' },
                      { key: 'can_view_caixinhas', label: 'Ver Caixinhas' },
                    ].map(({ key, label }) => {
                      const active = consultorPermissions[key as keyof ConsultorPermissionsWithDetails] as boolean
                      return (
                        <span
                          key={key}
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            active
                              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                              : 'bg-dark-700 text-gray-600 border border-dark-600'
                          }`}
                        >
                          {active ? '✓' : '✗'} {label}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
