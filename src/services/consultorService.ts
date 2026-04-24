// @ts-nocheck
/**
 * Consultor Service - Gerenciamento de consultores financeiros
 *
 * NOTA: Este arquivo usa @ts-nocheck porque as novas tabelas
 * (consultant_permissions) e RPCs ainda não foram adicionados ao tipo Database.
 * Após rodar as migrations 057/058, será necessário gerar os tipos novamente:
 * npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.ts
 */

import { supabase } from '../lib/supabase'
import type {
  ConsultorPermissionsWithDetails,
  ConsultorPermissionsInput,
  CreateConsultorInviteInput,
  FamilyInviteWithDetails,
  DbResult,
} from '../types'

export const consultorService = {
  async createConsultorInvite(
    input: CreateConsultorInviteInput
  ): Promise<DbResult<{ token: string; invite_id: string }>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const permissionsPayload = {
        ...input.permissions,
        profile_preset: input.profile_preset,
      }

      const { data, error } = await supabase.rpc('create_consultant_invite', {
        p_family_id: input.family_id,
        p_invited_email: input.invited_email,
        p_profile_preset: input.profile_preset,
        p_permissions: permissionsPayload,
        p_message: input.message || null,
      })

      if (error) return { data: null, error }

      if (!data?.success) {
        return { data: null, error: new Error(data?.error || 'Erro ao criar convite de consultor') }
      }

      return { data: { token: data.token, invite_id: data.invite_id }, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async acceptConsultorInvite(token: string): Promise<DbResult<{ family_id: string }>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase.rpc('accept_consultant_invite', {
        p_invite_token: token,
      })

      if (error) return { data: null, error }

      if (!data?.success) {
        return { data: null, error: new Error(data?.error || 'Erro ao aceitar convite') }
      }

      return { data: { family_id: data.family_id }, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async getConsultorPermissions(
    familyId: string
  ): Promise<DbResult<ConsultorPermissionsWithDetails | null>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase.rpc('get_consultant_permissions', {
        p_family_id: familyId,
      })

      if (error) return { data: null, error }

      if (!data?.success) {
        return { data: null, error: new Error(data?.error || 'Erro ao buscar permissões') }
      }

      return { data: data.data as ConsultorPermissionsWithDetails | null, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async updateConsultorPermissions(
    familyMemberId: string,
    permissions: ConsultorPermissionsInput
  ): Promise<DbResult<boolean>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase.rpc('update_consultant_permissions', {
        p_family_member_id: familyMemberId,
        p_permissions: permissions,
      })

      if (error) return { data: null, error }

      if (!data?.success) {
        return { data: null, error: new Error(data?.error || 'Erro ao atualizar permissões') }
      }

      return { data: true, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },

  async getConsultorInvite(familyId: string): Promise<DbResult<FamilyInviteWithDetails | null>> {
    if (!supabase) return { data: null, error: new Error('Supabase not configured') }

    try {
      const { data, error } = await supabase
        .from('family_invites_with_details')
        .select('*')
        .eq('family_id', familyId)
        .eq('member_type', 'consultor')
        .eq('status', 'pending')
        .maybeSingle()

      if (error) return { data: null, error }
      return { data: data as FamilyInviteWithDetails | null, error: null }
    } catch (err) {
      return { data: null, error: err as Error }
    }
  },
}
