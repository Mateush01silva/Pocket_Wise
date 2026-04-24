// @ts-nocheck
/**
 * Family Service - Gerenciamento de famílias, convites e membros
 *
 * Este serviço gerencia todas as operações relacionadas a:
 * - Convites de família (criar, aceitar, rejeitar)
 * - Membros da família (listar, atualizar role, remover)
 * - Criação e gerenciamento de famílias
 *
 * NOTA: Este arquivo usa @ts-nocheck porque as novas tabelas
 * (family_members, family_invites, etc) ainda não foram adicionadas ao tipo Database.
 * Após rodar a migration 004_create_family_invites_tables.sql, será necessário:
 * 1. Rodar: npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 * 2. Remover o @ts-nocheck no topo deste arquivo
 */

import { supabase, getCurrentUser, getUserFamilyId, clearFamilyIdCache } from '../lib/supabase'
import type {
  Family,
  FamilyInvite,
  FamilyInviteWithDetails,
  FamilyMember,
  FamilyMemberWithUser,
  CreateFamilyInviteInput,
  UpdateFamilyMemberInput,
  DbResult,
  DbListResult,
} from '../types'

// =====================================================
// FAMILY SERVICE
// =====================================================

export const familyService = {
  /**
   * Criar uma nova família
   */
  async createFamily(nome: string): Promise<DbResult<Family>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Criar família
    // @ts-ignore - Tabela ainda não está no tipo Database
    const { data: family, error: familyError } = await supabase
      .from('families')
      .insert({ nome })
      .select()
      .single()

    if (familyError || !family) {
      return { data: null, error: familyError }
    }

    // Atualizar o user com o family_id
    const { error: userError } = await supabase
      .from('users')
      .update({ family_id: family.id })
      .eq('id', currentUser.id)

    if (userError) {
      // Rollback - deletar família criada
      await supabase.from('families').delete().eq('id', family.id)
      return { data: null, error: userError }
    }

    // Adicionar o criador como admin
    // @ts-ignore - Tabela ainda não está no tipo Database
    const { error: memberError } = await supabase
    // @ts-ignore
      .from('family_members')
      .insert({
        family_id: family.id,
        user_id: currentUser.id,
        role: 'admin',
      })

    if (memberError) {
      // Se falhar ao adicionar como membro, continuar mesmo assim
      // O usuário já está na família pelo family_id
      console.warn('Failed to add creator as admin member:', memberError)
    }

    return { data: family, error: null }
  },

  /**
   * Obter informações da família do usuário
   */
  async getMyFamily(): Promise<DbResult<Family>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    const { data, error } = await supabase
      .from('families')
      .select('*')
      .eq('id', familyId)
      .single()

    return { data, error }
  },

  /**
   * Atualizar nome da família
   */
  async updateFamily(nome: string): Promise<DbResult<Family>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    const { data, error } = await supabase
      .from('families')
      .update({ nome })
      .eq('id', familyId)
      .select()
      .single()

    return { data, error }
  },
}

// =====================================================
// FAMILY INVITES SERVICE
// =====================================================

export const familyInvitesService = {
  /**
   * Criar um novo convite para a família
   * Retorna o convite com o token para gerar o link
   */
  async createInvite(input: CreateFamilyInviteInput): Promise<DbResult<FamilyInvite>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Verificar se o usuário é admin da família
    const { data: member } = await supabase
    // @ts-ignore
      .from('family_members')
      .select('role')
      .eq('family_id', input.family_id)
      .eq('user_id', currentUser.id)
      .single()

    if (!member || member.role !== 'admin') {
      return { data: null, error: new Error('Only admins can create invites') }
    }

    // Verificar se já existe um convite pendente para este email
    const { data: existingInvite } = await supabase
    // @ts-ignore
      .from('family_invites')
      .select('*')
      .eq('family_id', input.family_id)
      .eq('invited_email', input.invited_email.toLowerCase())
      .eq('status', 'pending')
      .single()

    if (existingInvite) {
      return { data: null, error: new Error('Already exists a pending invite for this email') }
    }

    // Verificar se o usuário com este email já é membro da família
    const { data: existingUser } = await supabase
      .from('auth.users')
      .select('id')
      .eq('email', input.invited_email.toLowerCase())
      .single()

    if (existingUser) {
      const { data: existingMember } = await supabase
    // @ts-ignore
        .from('family_members')
        .select('*')
        .eq('family_id', input.family_id)
        .eq('user_id', existingUser.id)
        .single()

      if (existingMember) {
        return { data: null, error: new Error('User is already a member of this family') }
      }
    }

    // Criar o convite
    const { data, error } = await supabase
    // @ts-ignore
      .from('family_invites')
      .insert({
        family_id: input.family_id,
        invited_by: currentUser.id,
        invited_email: input.invited_email.toLowerCase(),
        role: input.role || 'viewer',
        message: input.message || null,
      })
      .select()
      .single()

    return { data, error }
  },

  /**
   * Obter todos os convites da família do usuário (apenas admins)
   */
  async getMyFamilyInvites(): Promise<DbListResult<FamilyInviteWithDetails>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family'), count: null }
    }

    const { data, error, count } = await supabase
    // @ts-ignore
      .from('family_invites_with_details')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId)
      .order('created_at', { ascending: false })

    return { data, error, count }
  },

  /**
   * Obter convites enviados para o email do usuário atual
   */
  async getMyInvites(): Promise<DbListResult<FamilyInviteWithDetails>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated'), count: null }
    }

    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user?.email) {
      return { data: null, error: new Error('User email not found'), count: null }
    }

    const { data, error, count } = await supabase
    // @ts-ignore
      .from('family_invites_with_details')
      .select('*', { count: 'exact' })
      .eq('invited_email', authUser.user.email.toLowerCase())
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    return { data, error, count }
  },

  /**
   * Obter convite por token (público - para página de aceitar convite)
   * Usa RPC SECURITY DEFINER para evitar problemas de PGRST103 com a view
   * e garantir que anon veja family_name e invited_by_name sem restrição de RLS.
   */
  async getInviteByToken(token: string): Promise<DbResult<FamilyInviteWithDetails>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    // @ts-ignore
    const { data, error } = await supabase.rpc('get_invite_by_token', { invite_token: token })

    if (error || !data) {
      return { data: null, error: error || new Error('Invite not found') }
    }

    // Verificar se o convite expirou
    if (data.status === 'expired' || new Date(data.expires_at) < new Date()) {
      // Marcar como expirado se ainda não foi
      if (data.status !== 'expired') {
        await supabase
    // @ts-ignore
          .from('family_invites')
          .update({ status: 'expired' })
          .eq('id', data.id)
      }
      return { data: null, error: new Error('Invite has expired') }
    }

    // Verificar se o convite ainda está pendente
    if (data.status !== 'pending') {
      return { data: null, error: new Error(`Invite is ${data.status}`) }
    }

    return { data, error: null }
  },

  /**
   * Aceitar um convite
   * Usa RPC SECURITY DEFINER para contornar a política RLS que só permite
   * admins inserirem em family_members.
   */
  async acceptInvite(token: string): Promise<DbResult<FamilyMember>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const { data, error } = await (supabase as any).rpc('accept_family_invite', {
      invite_token: token,
    })

    if (error) {
      return { data: null, error }
    }

    if (!data?.success) {
      return { data: null, error: new Error(data?.error ?? 'Erro ao aceitar convite') }
    }

    clearFamilyIdCache()

    return { data: { id: data.member_id, family_id: data.family_id, role: data.role } as FamilyMember, error: null }
  },

  /**
   * Rejeitar um convite
   */
  async rejectInvite(token: string): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const { data: authUser } = await supabase.auth.getUser()
    if (!authUser.user?.email) {
      return { data: null, error: new Error('User email not found') }
    }

    // Buscar o convite
    const { data: invite, error: inviteError } = await supabase
    // @ts-ignore
      .from('family_invites')
      .select('*')
      .eq('token', token)
      .single()

    if (inviteError || !invite) {
      return { data: null, error: inviteError || new Error('Invite not found') }
    }

    // Verificar se o email corresponde
    if (invite.invited_email.toLowerCase() !== authUser.user.email.toLowerCase()) {
      return {
        data: null,
        error: new Error('This invite was sent to a different email address'),
      }
    }

    // Marcar como rejeitado
    const { error: updateError } = await supabase
    // @ts-ignore
      .from('family_invites')
      .update({ status: 'rejected' })
      .eq('id', invite.id)

    if (updateError) {
      return { data: null, error: updateError }
    }

    return { data: true, error: null }
  },

  /**
   * Cancelar/deletar um convite (apenas admin)
   */
  async deleteInvite(inviteId: string): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Buscar o convite para verificar a família
    const { data: invite, error: inviteError } = await supabase
    // @ts-ignore
      .from('family_invites')
      .select('family_id')
      .eq('id', inviteId)
      .single()

    if (inviteError || !invite) {
      return { data: null, error: inviteError || new Error('Invite not found') }
    }

    // Verificar se o usuário é admin
    const { data: member } = await supabase
    // @ts-ignore
      .from('family_members')
      .select('role')
      .eq('family_id', invite.family_id)
      .eq('user_id', currentUser.id)
      .single()

    if (!member || member.role !== 'admin') {
      return { data: null, error: new Error('Only admins can delete invites') }
    }

    // Deletar o convite
    const { error: deleteError } = await supabase
    // @ts-ignore
      .from('family_invites')
      .delete()
      .eq('id', inviteId)

    if (deleteError) {
      return { data: null, error: deleteError }
    }

    return { data: true, error: null }
  },

  // ─── Multi-família ────────────────────────────────────────────────────────

  async getUserFamilies(): Promise<{ families: UserFamilyInfo[]; activeFamilyId: string | null; personalFamilyId: string | null } | null> {
    if (!supabase) return null

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    try {
      const { data, error } = await (supabase as any).rpc('get_user_families').abortSignal(controller.signal)
      if (error || !data) {
        console.error('Erro ao buscar famílias do usuário:', error)
        return null
      }

      if (!data.success) return null

      return {
        families: data.families ?? [],
        activeFamilyId: data.active_family_id ?? null,
        personalFamilyId: data.personal_family_id ?? null,
      }
    } finally {
      clearTimeout(timeoutId)
    }
  },

  async switchFamily(targetFamilyId: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase não configurado' }

    const { data, error } = await (supabase as any).rpc('switch_active_family', {
      target_family_id: targetFamilyId,
    })

    if (error || !data?.success) {
      return { success: false, error: data?.error ?? error?.message ?? 'Erro ao trocar família' }
    }

    clearFamilyIdCache()

    return { success: true }
  },
}

export interface UserFamilyInfo {
  family_id: string
  nome: string
  role: 'admin' | 'editor' | 'viewer'
  is_personal: boolean
  member_type: 'familiar' | 'consultor'
}

// =====================================================
// FAMILY MEMBERS SERVICE
// =====================================================

export const familyMembersService = {
  /**
   * Obter todos os membros da família do usuário
   */
  async getMyFamilyMembers(): Promise<DbListResult<FamilyMemberWithUser>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured'), count: null }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family'), count: null }
    }

    // Usa RPC SECURITY DEFINER para contornar o RLS de users em cenários
    // multi-família (membros cujo users.family_id aponta para outra família).
    const { data, error } = await (supabase as any)
      .rpc('get_family_members_with_user', { p_family_id: familyId })

    return { data, error, count: data?.length ?? null }
  },

  /**
   * Atualizar a role de um membro (apenas admin)
   */
  async updateMemberRole(input: UpdateFamilyMemberInput): Promise<DbResult<FamilyMember>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await (supabase as any).rpc('update_member_role', {
      member_id: input.id,
      new_role: input.role,
    })

    if (error) {
      return { data: null, error }
    }

    if (!data?.success) {
      return { data: null, error: new Error(data?.error ?? 'Erro ao atualizar permissão') }
    }

    return { data: { id: input.id, role: input.role } as FamilyMember, error: null }
  },

  /**
   * Remover um membro da família (apenas admin)
   * Usa RPC SECURITY DEFINER para poder atualizar users.family_id do membro removido,
   * contornando a RLS que só permite ao usuário atualizar o próprio perfil.
   */
  async removeMember(memberId: string): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await (supabase as any).rpc('remove_family_member', {
      member_id: memberId,
    })

    if (error) {
      return { data: null, error }
    }

    if (!data?.success) {
      return { data: null, error: new Error(data?.error ?? 'Erro ao remover membro') }
    }

    return { data: true, error: null }
  },

  /**
   * Sair da família (remover a si mesmo)
   */
  async leaveFamily(): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    const familyId = await getUserFamilyId()
    if (!familyId) {
      return { data: null, error: new Error('User has no family') }
    }

    // Buscar o membro atual
    const { data: member } = await supabase
    // @ts-ignore
      .from('family_members')
      .select('id, role')
      .eq('family_id', familyId)
      .eq('user_id', currentUser.id)
      .single()

    if (!member) {
      return { data: null, error: new Error('You are not a member of any family') }
    }

    // Não permitir sair se for o último admin
    if (member.role === 'admin') {
      const { data: admins } = await supabase
    // @ts-ignore
        .from('family_members')
        .select('id')
        .eq('family_id', familyId)
        .eq('role', 'admin')

      if (admins && admins.length === 1) {
        return {
          data: null,
          error: new Error('You are the last admin. Promote another member to admin first'),
        }
      }
    }

    // Remover o family_id do usuário
    await supabase.from('users').update({ family_id: null }).eq('id', currentUser.id)

    // Remover o membro
    const { error: deleteError } = await supabase
    // @ts-ignore
      .from('family_members')
      .delete()
      .eq('id', member.id)

    if (deleteError) {
      return { data: null, error: deleteError }
    }

    return { data: true, error: null }
  },
}
