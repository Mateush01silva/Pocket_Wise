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
   */
  async getInviteByToken(token: string): Promise<DbResult<FamilyInviteWithDetails>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const { data, error } = await supabase
    // @ts-ignore
      .from('family_invites_with_details')
      .select('*')
      .eq('token', token)
      .single()

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
   * O usuário deve estar autenticado e o email deve corresponder
   */
  async acceptInvite(token: string): Promise<DbResult<FamilyMember>> {
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

    // Verificar status e expiração
    if (invite.status !== 'pending') {
      return { data: null, error: new Error(`Invite is ${invite.status}`) }
    }

    if (new Date(invite.expires_at) < new Date()) {
    // @ts-ignore
      await supabase.from('family_invites').update({ status: 'expired' }).eq('id', invite.id)
      return { data: null, error: new Error('Invite has expired') }
    }

    // Verificar se o usuário já é membro da família
    const { data: existingMember } = await supabase
    // @ts-ignore
      .from('family_members')
      .select('*')
      .eq('family_id', invite.family_id)
      .eq('user_id', currentUser.id)
      .single()

    if (existingMember) {
      return { data: null, error: new Error('You are already a member of this family') }
    }

    // Preservar personal_family_id antes de trocar a família ativa.
    // Se o usuário já tem uma família própria (family_id) e personal_family_id
    // ainda não foi definido, salvar agora para não perder o contexto pessoal.
    const { data: userRow } = await (supabase as any)
      .from('users')
      .select('family_id, personal_family_id')
      .eq('id', currentUser.id)
      .single()

    const updatePayload: Record<string, string | null> = { family_id: invite.family_id }
    if (userRow?.family_id && !userRow?.personal_family_id) {
      updatePayload.personal_family_id = userRow.family_id
    }

    const { error: userError } = await (supabase as any)
      .from('users')
      .update(updatePayload)
      .eq('id', currentUser.id)

    if (userError) {
      return { data: null, error: userError }
    }

    // Adicionar como membro
    const { data: member, error: memberError } = await supabase
    // @ts-ignore
      .from('family_members')
      .insert({
        family_id: invite.family_id,
        user_id: currentUser.id,
        role: invite.role,
      })
      .select()
      .single()

    if (memberError) {
      // Rollback - restaurar family_id anterior
      await (supabase as any)
        .from('users')
        .update({ family_id: userRow?.family_id ?? null })
        .eq('id', currentUser.id)
      return { data: null, error: memberError }
    }

    // Marcar convite como aceito
    await supabase
    // @ts-ignore
      .from('family_invites')
      .update({
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: currentUser.id,
      })
      .eq('id', invite.id)

    return { data: member, error: null }
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

    const { data, error } = await (supabase as any).rpc('get_user_families')
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

    const { data, error, count } = await supabase
    // @ts-ignore
      .from('family_members_with_user')
      .select('*', { count: 'exact' })
      .eq('family_id', familyId)
      .order('joined_at', { ascending: true })

    return { data, error, count }
  },

  /**
   * Atualizar a role de um membro (apenas admin)
   */
  async updateMemberRole(input: UpdateFamilyMemberInput): Promise<DbResult<FamilyMember>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Buscar o membro para verificar a família
    const { data: member, error: memberError } = await supabase
    // @ts-ignore
      .from('family_members')
      .select('family_id, user_id')
      .eq('id', input.id)
      .single()

    if (memberError || !member) {
      return { data: null, error: memberError || new Error('Member not found') }
    }

    // Verificar se o usuário é admin
    const { data: currentMember } = await supabase
    // @ts-ignore
      .from('family_members')
      .select('role')
      .eq('family_id', member.family_id)
      .eq('user_id', currentUser.id)
      .single()

    if (!currentMember || currentMember.role !== 'admin') {
      return { data: null, error: new Error('Only admins can update member roles') }
    }

    // Não permitir remover o último admin
    if (input.role !== 'admin') {
      const { data: admins } = await supabase
    // @ts-ignore
        .from('family_members')
        .select('id')
        .eq('family_id', member.family_id)
        .eq('role', 'admin')

      if (admins && admins.length === 1 && admins[0].id === input.id) {
        return { data: null, error: new Error('Cannot remove the last admin') }
      }
    }

    // Atualizar a role
    const { data: updatedMember, error: updateError } = await supabase
    // @ts-ignore
      .from('family_members')
      .update({ role: input.role })
      .eq('id', input.id)
      .select()
      .single()

    return { data: updatedMember, error: updateError }
  },

  /**
   * Remover um membro da família (apenas admin)
   */
  async removeMember(memberId: string): Promise<DbResult<boolean>> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not configured') }
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return { data: null, error: new Error('User not authenticated') }
    }

    // Buscar o membro
    const { data: member, error: memberError } = await supabase
    // @ts-ignore
      .from('family_members')
      .select('family_id, user_id, role')
      .eq('id', memberId)
      .single()

    if (memberError || !member) {
      return { data: null, error: memberError || new Error('Member not found') }
    }

    // Não permitir remover a si mesmo
    if (member.user_id === currentUser.id) {
      return { data: null, error: new Error('You cannot remove yourself from the family') }
    }

    // Verificar se o usuário é admin
    const { data: currentMember } = await supabase
    // @ts-ignore
      .from('family_members')
      .select('role')
      .eq('family_id', member.family_id)
      .eq('user_id', currentUser.id)
      .single()

    if (!currentMember || currentMember.role !== 'admin') {
      return { data: null, error: new Error('Only admins can remove members') }
    }

    // Não permitir remover o último admin
    if (member.role === 'admin') {
      const { data: admins } = await supabase
    // @ts-ignore
        .from('family_members')
        .select('id')
        .eq('family_id', member.family_id)
        .eq('role', 'admin')

      if (admins && admins.length === 1) {
        return { data: null, error: new Error('Cannot remove the last admin') }
      }
    }

    // Remover o family_id do usuário
    await supabase.from('users').update({ family_id: null }).eq('id', member.user_id)

    // Remover o membro
    const { error: deleteError } = await supabase
    // @ts-ignore
      .from('family_members')
      .delete()
      .eq('id', memberId)

    if (deleteError) {
      return { data: null, error: deleteError }
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
