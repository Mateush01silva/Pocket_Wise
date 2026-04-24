import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  Family,
  FamilyInvite,
  FamilyInviteWithDetails,
  FamilyMemberWithUser,
  CreateFamilyInviteInput,
} from '../types'
import {
  familyService,
  familyInvitesService,
  familyMembersService,
} from '../services/familyService'

interface FamilyState {
  // Família
  family: Family | null

  // Membros
  members: FamilyMemberWithUser[]

  // Convites
  invites: FamilyInviteWithDetails[]
  myInvites: FamilyInviteWithDetails[] // Convites recebidos pelo usuário

  // Loading states
  isLoadingFamily: boolean
  isLoadingMembers: boolean
  isLoadingInvites: boolean

  // Errors
  error: string | null

  // Initialized flag
  initialized: boolean
}

interface FamilyActions {
  // Inicialização
  initialize: () => Promise<void>

  // Family
  createFamily: (nome: string) => Promise<Family | null>
  fetchFamily: () => Promise<void>
  updateFamily: (nome: string) => Promise<Family | null>

  // Members
  fetchMembers: () => Promise<void>
  updateMemberRole: (memberId: string, role: 'admin' | 'editor' | 'viewer') => Promise<boolean>
  removeMember: (memberId: string) => Promise<boolean>
  leaveFamily: () => Promise<boolean>

  // Invites
  fetchInvites: () => Promise<void>
  fetchMyInvites: () => Promise<void>
  createInvite: (input: CreateFamilyInviteInput) => Promise<FamilyInvite | null>
  acceptInvite: (token: string) => Promise<boolean>
  rejectInvite: (token: string) => Promise<boolean>
  deleteInvite: (inviteId: string) => Promise<boolean>

  // Queries
  getMemberById: (memberId: string) => FamilyMemberWithUser | undefined
  getInviteById: (inviteId: string) => FamilyInviteWithDetails | undefined
  isAdmin: (userId: string) => boolean
  canEditFamily: (userId: string) => boolean

  // Utilities
  clearError: () => void
  reset: () => void
  refresh: () => Promise<void>
}

type FamilyStore = FamilyState & FamilyActions

const initialState: FamilyState = {
  family: null,
  members: [],
  invites: [],
  myInvites: [],
  isLoadingFamily: false,
  isLoadingMembers: false,
  isLoadingInvites: false,
  error: null,
  initialized: false,
}

export const useFamilyStore = create<FamilyStore>()(
  immer((set, get) => ({
    // Estado inicial
    ...initialState,

    // =====================================================
    // INICIALIZAÇÃO
    // =====================================================

    initialize: async () => {
      const { initialized } = get()

      if (initialized) {
        return
      }

      try {
        // Buscar dados em paralelo
        await Promise.all([
          get().fetchFamily(),
          get().fetchMembers(),
          get().fetchInvites(),
          get().fetchMyInvites(),
        ])

        set({ initialized: true })
      } catch (error) {
        console.error('Erro ao inicializar family store:', error)
        set({ error: (error as Error).message, initialized: true })
      }
    },

    // =====================================================
    // FAMILY
    // =====================================================

    createFamily: async (nome: string) => {
      set({ isLoadingFamily: true, error: null })

      try {
        const { data, error } = await familyService.createFamily(nome)

        if (error) {
          set({ error: error.message, isLoadingFamily: false })
          return null
        }

        if (data) {
          set({ family: data, isLoadingFamily: false })
          // Recarregar membros após criar família
          await get().fetchMembers()
          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao criar família:', error)
        set({ error: (error as Error).message, isLoadingFamily: false })
        return null
      }
    },

    fetchFamily: async () => {
      set({ isLoadingFamily: true, error: null })

      try {
        const { data, error } = await familyService.getMyFamily()

        if (error) {
          // Não é erro se o usuário não tem família ainda
          if (error.message === 'User has no family') {
            set({ family: null, isLoadingFamily: false })
            return
          }
          set({ error: error.message, isLoadingFamily: false })
          return
        }

        set({ family: data, isLoadingFamily: false })
      } catch (error) {
        console.error('Erro ao buscar família:', error)
        set({ error: (error as Error).message, isLoadingFamily: false })
      }
    },

    updateFamily: async (nome: string) => {
      set({ isLoadingFamily: true, error: null })

      try {
        const { data, error } = await familyService.updateFamily(nome)

        if (error) {
          set({ error: error.message, isLoadingFamily: false })
          return null
        }

        if (data) {
          set({ family: data, isLoadingFamily: false })
          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao atualizar família:', error)
        set({ error: (error as Error).message, isLoadingFamily: false })
        return null
      }
    },

    // =====================================================
    // MEMBERS
    // =====================================================

    fetchMembers: async () => {
      set({ isLoadingMembers: true, error: null })

      try {
        const { data, error } = await familyMembersService.getMyFamilyMembers()

        if (error) {
          // Não é erro se o usuário não tem família ainda
          if (error.message === 'User has no family') {
            set({ members: [], isLoadingMembers: false })
            return
          }
          set({ error: error.message, isLoadingMembers: false })
          return
        }

        set({ members: data || [], isLoadingMembers: false })
      } catch (error) {
        console.error('Erro ao buscar membros:', error)
        set({ error: (error as Error).message, isLoadingMembers: false })
      }
    },

    updateMemberRole: async (memberId: string, role: 'admin' | 'editor' | 'viewer') => {
      set({ error: null })

      try {
        const { data, error } = await familyMembersService.updateMemberRole({
          id: memberId,
          role,
        })

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Atualizar o membro no estado
          set((state) => {
            const index = state.members.findIndex((m) => m.id === memberId)
            if (index !== -1) {
              state.members[index].role = role
            }
          })
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao atualizar role do membro:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    removeMember: async (memberId: string) => {
      set({ error: null })

      try {
        const { data, error } = await familyMembersService.removeMember(memberId)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Remover do estado
          set((state) => {
            state.members = state.members.filter((m) => m.id !== memberId)
          })
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao remover membro:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    leaveFamily: async () => {
      set({ error: null })

      try {
        const { data, error } = await familyMembersService.leaveFamily()

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Reset do estado
          set({
            family: null,
            members: [],
            invites: [],
            initialized: false,
          })
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao sair da família:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    // =====================================================
    // INVITES
    // =====================================================

    fetchInvites: async () => {
      set({ isLoadingInvites: true, error: null })

      try {
        const { data, error } = await familyInvitesService.getMyFamilyInvites()

        if (error) {
          // Não é erro se o usuário não tem família ainda
          if (error.message === 'User has no family') {
            set({ invites: [], isLoadingInvites: false })
            return
          }
          set({ error: error.message, isLoadingInvites: false })
          return
        }

        set({ invites: data || [], isLoadingInvites: false })
      } catch (error) {
        console.error('Erro ao buscar convites:', error)
        set({ error: (error as Error).message, isLoadingInvites: false })
      }
    },

    fetchMyInvites: async () => {
      set({ error: null })

      try {
        const { data, error } = await familyInvitesService.getMyInvites()

        if (error) {
          set({ error: error.message })
          return
        }

        set({ myInvites: data || [] })
      } catch (error) {
        console.error('Erro ao buscar meus convites:', error)
        set({ error: (error as Error).message })
      }
    },

    createInvite: async (input: CreateFamilyInviteInput) => {
      set({ error: null })

      try {
        const { data, error } = await familyInvitesService.createInvite(input)

        if (error) {
          set({ error: error.message })
          return null
        }

        if (data) {
          // Recarregar lista de convites
          await get().fetchInvites()
          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao criar convite:', error)
        set({ error: (error as Error).message })
        return null
      }
    },

    acceptInvite: async (token: string) => {
      set({ error: null })

      try {
        const { data, error } = await familyInvitesService.acceptInvite(token)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Recarregar tudo após aceitar convite (resetar initialized para forçar recarga)
          set({ initialized: false })
          await get().initialize()
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao aceitar convite:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    rejectInvite: async (token: string) => {
      set({ error: null })

      try {
        const { data, error } = await familyInvitesService.rejectInvite(token)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Recarregar meus convites
          await get().fetchMyInvites()
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao rejeitar convite:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    deleteInvite: async (inviteId: string) => {
      set({ error: null })

      try {
        const { data, error } = await familyInvitesService.deleteInvite(inviteId)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Remover do estado
          set((state) => {
            state.invites = state.invites.filter((i) => i.id !== inviteId)
          })
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao deletar convite:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    // =====================================================
    // QUERIES
    // =====================================================

    getMemberById: (memberId: string) => {
      return get().members.find((m) => m.id === memberId)
    },

    getInviteById: (inviteId: string) => {
      return get().invites.find((i) => i.id === inviteId)
    },

    isAdmin: (userId: string) => {
      const member = get().members.find((m) => m.user_id === userId)
      return member?.role === 'admin'
    },

    canEditFamily: (userId: string) => {
      const member = get().members.find((m) => m.user_id === userId)
      return member?.role === 'admin' || member?.role === 'editor'
    },

    // =====================================================
    // UTILITIES
    // =====================================================

    clearError: () => {
      set({ error: null })
    },

    reset: () => {
      set(initialState)
    },

    refresh: async () => {
      set({ initialized: false })
      await get().initialize()
    },
  }))
)
