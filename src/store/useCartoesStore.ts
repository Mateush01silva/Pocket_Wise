import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { Cartao, CreateCartaoInput } from '../types'
import { db } from '../services/database'

interface CartoesState {
  cartoes: Cartao[]
  isLoading: boolean
  error: string | null
}

interface CartoesActions {
  // CRUD
  fetchCartoes: () => Promise<void>
  createCartao: (cartao: CreateCartaoInput) => Promise<Cartao | null>
  updateCartao: (id: string, data: Partial<Cartao>) => Promise<void>
  deleteCartao: (id: string) => Promise<void>

  // Queries
  getCartaoById: (id: string) => Cartao | undefined
  getCartoesAtivos: () => Cartao[]
}

type CartoesStore = CartoesState & CartoesActions

export const useCartoesStore = create<CartoesStore>()(
  persist(
    immer((set, get) => ({
      // Estado inicial
      cartoes: [],
      isLoading: false,
      error: null,

      // Buscar cartões
      fetchCartoes: async () => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.cartoes.getAll()

          if (error) throw error

          set({ cartoes: data || [], isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar cartões:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Criar cartão
      createCartao: async (cartaoData) => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.cartoes.create(cartaoData)

          if (error) throw error
          if (!data) return null

          set((state) => {
            state.cartoes.push(data)
            state.isLoading = false
          })

          return data
        } catch (error) {
          console.error('Erro ao criar cartão:', error)
          set({ error: (error as Error).message, isLoading: false })
          return null
        }
      },

      // Atualizar cartão
      updateCartao: async (id, updateData) => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.cartoes.update({ id, ...updateData })

          if (error) throw error
          if (!data) return

          set((state) => {
            const index = state.cartoes.findIndex((c) => c.id === id)
            if (index !== -1) {
              state.cartoes[index] = data
            }
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao atualizar cartão:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Deletar cartão
      deleteCartao: async (id) => {
        set({ isLoading: true, error: null })

        try {
          const { error } = await db.cartoes.delete(id)

          if (error) throw error

          set((state) => {
            state.cartoes = state.cartoes.filter((c) => c.id !== id)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao deletar cartão:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Queries

      getCartaoById: (id) => {
        return get().cartoes.find((c) => c.id === id)
      },

      getCartoesAtivos: () => {
        return get().cartoes.filter((c) => c.ativo)
      },
    })),
    {
      name: 'pocketwise-cartoes-store',
      partialize: (state) => ({
        cartoes: state.cartoes,
      }),
      onRehydrateStorage: () => {
        console.log('🔄 Iniciando hidratação do store de cartões...')
        return (state, error) => {
          if (error) {
            console.error('❌ Erro ao hidratar store de cartões:', error)
            try {
              localStorage.removeItem('pocketwise-cartoes-store')
              console.log('🗑️ Storage de cartões corrompido foi limpo')
            } catch (e) {
              console.error('Erro ao limpar storage:', e)
            }
            return
          }

          // Validar dados hidratados
          if (state) {
            try {
              // Garantir que cartoes é um array
              if (!Array.isArray(state.cartoes)) {
                console.warn('⚠️ Cartões não é um array, resetando...')
                state.cartoes = []
              }

              // Validar cada cartão
              state.cartoes = state.cartoes.filter((cartao: any) => {
                return cartao && typeof cartao === 'object' && cartao.id && cartao.nome
              })

              console.log(`✅ Store de cartões hidratado com ${state.cartoes.length} cartões`)
            } catch (validationError) {
              console.error('❌ Erro ao validar dados hidratados:', validationError)
              state.cartoes = []
            }
          }
        }
      },
    }
  )
)
