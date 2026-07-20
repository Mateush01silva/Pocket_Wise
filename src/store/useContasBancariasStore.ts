import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import type { ContaBancaria, CreateContaBancariaInput } from '../types'
import { db } from '../services/database'

interface ContasBancariasState {
  contas: ContaBancaria[]
  isLoading: boolean
  error: string | null
}

interface ContasBancariasActions {
  // CRUD
  fetchContas: () => Promise<void>
  createConta: (conta: CreateContaBancariaInput) => Promise<ContaBancaria | null>
  updateConta: (id: string, data: Partial<ContaBancaria>) => Promise<void>
  deleteConta: (id: string) => Promise<void>

  // Ações especiais
  atualizarSaldo: (id: string, novoSaldo: number) => Promise<void>
  transferirEntreContas: (
    contaOrigemId: string,
    contaDestinoId: string,
    valor: number
  ) => Promise<void>

  // Queries
  getContaById: (id: string) => ContaBancaria | undefined
  getContasAtivas: () => ContaBancaria[]
  getSaldoTotal: () => number
  getSaldoDisponivel: () => number
}

type ContasBancariasStore = ContasBancariasState & ContasBancariasActions

export const useContasBancariasStore = create<ContasBancariasStore>()(
  persist(
    immer((set, get) => ({
      // Estado inicial
      contas: [],
      isLoading: false,
      error: null,

      // Buscar contas
      fetchContas: async () => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.contas.getAll()

          if (error) throw error

          set({ contas: data || [], isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar contas bancárias:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Criar conta
      createConta: async (contaData) => {
        set({ isLoading: true, error: null })

        try {
          // saldo_atual é definido automaticamente no database service
          const { data, error } = await db.contas.create(contaData)

          if (error) throw error
          if (!data) return null

          set((state) => {
            state.contas.push(data)
            state.isLoading = false
          })

          return data
        } catch (error) {
          console.error('Erro ao criar conta:', error)
          set({ error: (error as Error).message, isLoading: false })
          return null
        }
      },

      // Atualizar conta
      updateConta: async (id, updateData) => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.contas.update({ id, ...updateData })

          if (error) throw error
          if (!data) return

          set((state) => {
            const index = state.contas.findIndex((c) => c.id === id)
            if (index !== -1) {
              state.contas[index] = data
            }
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao atualizar conta:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Deletar conta
      deleteConta: async (id) => {
        set({ isLoading: true, error: null })

        try {
          const { error } = await db.contas.delete(id)

          if (error) throw error

          set((state) => {
            state.contas = state.contas.filter((c) => c.id !== id)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao deletar conta:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Atualizar saldo manualmente (para ajustes/reconciliação).
      // RPC atômica no banco — não usar updateConta com saldo_atual absoluto,
      // pois o valor local pode estar desatualizado e sobrescrever os deltas
      // aplicados pelos triggers de lançamentos.
      atualizarSaldo: async (id, novoSaldo) => {
        set({ error: null })

        const { error } = await db.contas.ajustarSaldo(id, novoSaldo)

        if (error) {
          set({ error: error.message })
          throw error
        }

        await get().fetchContas()
      },

      // Transferir entre contas — RPC atômica: validação de saldo e os dois
      // deltas acontecem no servidor, na mesma transação.
      transferirEntreContas: async (contaOrigemId, contaDestinoId, valor) => {
        set({ error: null })

        const { error } = await db.contas.transferir(contaOrigemId, contaDestinoId, valor)

        if (error) {
          set({ error: error.message })
          throw new Error(error.message)
        }

        await get().fetchContas()
      },

      // Queries

      getContaById: (id) => {
        return get().contas.find((c) => c.id === id)
      },

      getContasAtivas: () => {
        return get().contas.filter((c) => c.ativo)
      },

      getSaldoTotal: () => {
        return get()
          .contas.filter((c) => c.ativo)
          .reduce((sum, c) => sum + c.saldo_atual, 0)
      },

      getSaldoDisponivel: () => {
        return get()
          .contas.filter((c) => c.ativo && c.tipo !== 'investimento')
          .reduce((sum, c) => sum + c.saldo_atual, 0)
      },
    })),
    {
      name: 'pocketwise-contas-bancarias-store',
      partialize: (state) => ({
        contas: state.contas,
      }),
      onRehydrateStorage: () => {
        console.log('🔄 Iniciando hidratação do store de contas bancárias...')
        return (state, error) => {
          if (error) {
            console.error('❌ Erro ao hidratar store de contas bancárias:', error)
            try {
              localStorage.removeItem('pocketwise-contas-bancarias-store')
              console.log('🗑️ Storage de contas corrompido foi limpo')
            } catch (e) {
              console.error('Erro ao limpar storage:', e)
            }
            return
          }

          // Validar dados hidratados
          if (state) {
            try {
              // Garantir que contas é um array
              if (!Array.isArray(state.contas)) {
                console.warn('⚠️ Contas não é um array, resetando...')
                state.contas = []
              }

              // Validar cada conta
              state.contas = state.contas.filter((conta: any) => {
                return conta && typeof conta === 'object' && conta.id && conta.nome
              })

              console.log(`✅ Store de contas bancárias hidratado com ${state.contas.length} contas`)
            } catch (validationError) {
              console.error('❌ Erro ao validar dados hidratados:', validationError)
              state.contas = []
            }
          }
        }
      },
    }
  )
)
