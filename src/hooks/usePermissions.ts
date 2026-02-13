import { useAuth } from '../contexts/AuthContext'
import { useFamilyStore } from '../store/useFamilyStore'

/**
 * Hook para verificar permissões do usuário na família.
 *
 * Roles:
 * - admin: Acesso total (criar, editar, deletar tudo + gerenciar família)
 * - editor: Pode criar, editar, deletar dados financeiros
 * - viewer: Somente leitura - não pode criar, editar ou deletar nada
 *
 * Se o usuário não faz parte de nenhuma família (members vazio),
 * ele é tratado como admin da própria conta.
 */
export function usePermissions() {
  const { user } = useAuth()
  const members = useFamilyStore((state) => state.members)
  const isAdmin = useFamilyStore((state) => state.isAdmin)
  const canEditFamily = useFamilyStore((state) => state.canEditFamily)

  const userId = user?.id || ''

  // Se não há membros carregados (ou usuário solo), considerar como admin
  const hasMembers = members.length > 0
  const userMember = hasMembers ? members.find((m) => m.user_id === userId) : null

  // Usuário solo ou admin → acesso total
  const isUserAdmin = !hasMembers || isAdmin(userId)

  // Pode editar: admin ou editor
  const canEdit = !hasMembers || canEditFamily(userId)

  // Viewer: faz parte da família mas é viewer
  const isViewer = hasMembers && userMember?.role === 'viewer'

  return {
    /** Se o usuário é admin da família */
    isAdmin: isUserAdmin,
    /** Se o usuário pode criar/editar/deletar dados (admin ou editor) */
    canEdit,
    /** Se o usuário é somente visualizador */
    isViewer,
    /** Role do usuário na família */
    role: userMember?.role || (hasMembers ? 'viewer' : 'admin'),
  }
}
