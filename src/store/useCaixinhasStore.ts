import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  Caixinha,
  CaixinhaComDetalhes,
  TransacaoCaixinha,
  CreateCaixinhaInput,
  UpdateCaixinhaInput,
  CreateTransacaoCaixinhaInput,
  AlocarSaldoMensalInput,
  CaixinhasSummary,
} from '../types'
import { caixinhasService, transacoesCaixinhasService } from '../services/caixinhasService'

interface CaixinhasState {
  // Caixinhas
  caixinhas: CaixinhaComDetalhes[]

  // Transações
  transacoes: Record<string, TransacaoCaixinha[]> // Mapeado por caixinha_id

  // Summary
  summary: CaixinhasSummary | null

  // Loading states
  isLoadingCaixinhas: boolean
  isLoadingTransacoes: boolean
  isLoadingSummary: boolean

  // Errors
  error: string | null

  // Initialized flag
  initialized: boolean
}

interface CaixinhasActions {
  // Inicialização
  initialize: () => Promise<void>

  // Caixinhas
  fetchCaixinhas: () => Promise<void>
  fetchCaixinhaById: (id: string) => Promise<CaixinhaComDetalhes | null>
  createCaixinha: (input: CreateCaixinhaInput) => Promise<Caixinha | null>
  updateCaixinha: (input: UpdateCaixinhaInput) => Promise<Caixinha | null>
  deleteCaixinha: (id: string) => Promise<boolean>

  // Summary
  fetchSummary: () => Promise<void>

  // Transações
  fetchTransacoes: (caixinhaId: string) => Promise<void>
  createTransacao: (input: CreateTransacaoCaixinhaInput) => Promise<TransacaoCaixinha | null>
  deleteTransacao: (transacaoId: string, caixinhaId: string) => Promise<boolean>
  alocarSaldoMensal: (input: AlocarSaldoMensalInput) => Promise<boolean>

  // Queries
  getCaixinhaById: (id: string) => CaixinhaComDetalhes | undefined
  getTransacoesByCaixinha: (caixinhaId: string) => TransacaoCaixinha[]
  getTotalAlocadoDoMes: (mesReferencia: string) => number

  // Utilities
  clearError: () => void
  reset: () => void
}

type CaixinhasStore = CaixinhasState & CaixinhasActions

const initialState: CaixinhasState = {
  caixinhas: [],
  transacoes: {},
  summary: null,
  isLoadingCaixinhas: false,
  isLoadingTransacoes: false,
  isLoadingSummary: false,
  error: null,
  initialized: false,
}

export const useCaixinhasStore = create<CaixinhasStore>()(
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
          get().fetchCaixinhas(),
          get().fetchSummary(),
        ])

        set({ initialized: true })
      } catch (error) {
        console.error('Erro ao inicializar caixinhas store:', error)
        set({ error: (error as Error).message, initialized: true })
      }
    },

    // =====================================================
    // CAIXINHAS
    // =====================================================

    fetchCaixinhas: async () => {
      set({ isLoadingCaixinhas: true, error: null })

      try {
        const { data, error } = await caixinhasService.getCaixinhas()

        if (error) {
          set({ error: error.message, isLoadingCaixinhas: false })
          return
        }

        set({ caixinhas: data || [], isLoadingCaixinhas: false })
      } catch (error) {
        console.error('Erro ao buscar caixinhas:', error)
        set({ error: (error as Error).message, isLoadingCaixinhas: false })
      }
    },

    fetchCaixinhaById: async (id: string) => {
      set({ error: null })

      try {
        const { data, error } = await caixinhasService.getCaixinhaById(id)

        if (error) {
          set({ error: error.message })
          return null
        }

        // Atualizar no estado se já existe
        if (data) {
          set((state) => {
            const index = state.caixinhas.findIndex((c) => c.id === id)
            if (index !== -1) {
              state.caixinhas[index] = data
            } else {
              state.caixinhas.push(data)
            }
          })
          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao buscar caixinha:', error)
        set({ error: (error as Error).message })
        return null
      }
    },

    createCaixinha: async (input: CreateCaixinhaInput) => {
      set({ error: null })

      try {
        const { data, error } = await caixinhasService.createCaixinha(input)

        if (error) {
          set({ error: error.message })
          return null
        }

        if (data) {
          // Recarregar listas
          await Promise.all([
            get().fetchCaixinhas(),
            get().fetchSummary(),
          ])
          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao criar caixinha:', error)
        set({ error: (error as Error).message })
        return null
      }
    },

    updateCaixinha: async (input: UpdateCaixinhaInput) => {
      set({ error: null })

      try {
        const { data, error } = await caixinhasService.updateCaixinha(input)

        if (error) {
          set({ error: error.message })
          return null
        }

        if (data) {
          // Recarregar listas
          await Promise.all([
            get().fetchCaixinhas(),
            get().fetchSummary(),
          ])
          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao atualizar caixinha:', error)
        set({ error: (error as Error).message })
        return null
      }
    },

    deleteCaixinha: async (id: string) => {
      set({ error: null })

      try {
        const { data, error } = await caixinhasService.deleteCaixinha(id)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Remover do estado
          set((state) => {
            state.caixinhas = state.caixinhas.filter((c) => c.id !== id)
            delete state.transacoes[id]
          })

          // Atualizar summary
          await get().fetchSummary()
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao deletar caixinha:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    // =====================================================
    // SUMMARY
    // =====================================================

    fetchSummary: async () => {
      set({ isLoadingSummary: true, error: null })

      try {
        const { data, error } = await caixinhasService.getCaixinhasSummary()

        if (error) {
          set({ error: error.message, isLoadingSummary: false })
          return
        }

        set({ summary: data, isLoadingSummary: false })
      } catch (error) {
        console.error('Erro ao buscar summary:', error)
        set({ error: (error as Error).message, isLoadingSummary: false })
      }
    },

    // =====================================================
    // TRANSAÇÕES
    // =====================================================

    fetchTransacoes: async (caixinhaId: string) => {
      set({ isLoadingTransacoes: true, error: null })

      try {
        const { data, error } = await transacoesCaixinhasService.getTransacoes(caixinhaId)

        if (error) {
          set({ error: error.message, isLoadingTransacoes: false })
          return
        }

        set((state) => {
          state.transacoes[caixinhaId] = data || []
          state.isLoadingTransacoes = false
        })
      } catch (error) {
        console.error('Erro ao buscar transações:', error)
        set({ error: (error as Error).message, isLoadingTransacoes: false })
      }
    },

    createTransacao: async (input: CreateTransacaoCaixinhaInput) => {
      set({ error: null })

      try {
        const { data, error } = await transacoesCaixinhasService.createTransacao(input)

        if (error) {
          set({ error: error.message })
          return null
        }

        if (data) {
          // Recarregar tudo afetado
          await Promise.all([
            get().fetchCaixinhas(),
            get().fetchTransacoes(input.caixinha_id),
            get().fetchSummary(),
          ])
          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao criar transação:', error)
        set({ error: (error as Error).message })
        return null
      }
    },

    deleteTransacao: async (transacaoId: string, caixinhaId: string) => {
      set({ error: null })

      try {
        const { data, error } = await transacoesCaixinhasService.deleteTransacao(transacaoId)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Recarregar tudo afetado
          await Promise.all([
            get().fetchCaixinhas(),
            get().fetchTransacoes(caixinhaId),
            get().fetchSummary(),
          ])
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao deletar transação:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    alocarSaldoMensal: async (input: AlocarSaldoMensalInput) => {
      set({ error: null })

      try {
        const { data, error } = await transacoesCaixinhasService.alocarSaldoMensal(input)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Recarregar tudo
          await Promise.all([
            get().fetchCaixinhas(),
            get().fetchSummary(),
            // Recarregar transações de todas as caixinhas afetadas
            ...input.alocacoes.map((a) => get().fetchTransacoes(a.caixinha_id)),
          ])
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao alocar saldo mensal:', error)
        set({ error: (error as Error).message })
        return false
      }
    },

    // =====================================================
    // QUERIES
    // =====================================================

    getCaixinhaById: (id: string) => {
      return get().caixinhas.find((c) => c.id === id)
    },

    getTransacoesByCaixinha: (caixinhaId: string) => {
      return get().transacoes[caixinhaId] || []
    },

    getTotalAlocadoDoMes: (mesReferencia: string) => {
      // Soma todas as alocações feitas para o mês especificado (YYYY-MM)
      // A transação pode ter origem_mes_referencia como 'YYYY-MM' ou 'YYYY-MM-DD'
      const todasTransacoes = Object.values(get().transacoes).flat()
      return todasTransacoes
        .filter(
          (t) =>
            t.origem_mes_referencia &&
            t.origem_mes_referencia.startsWith(mesReferencia) &&
            t.tipo === 'deposito'
        )
        .reduce((sum, t) => sum + t.valor, 0)
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
  }))
)
