import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

export interface Patrimonio {
  id: string
  user_id: string
  family_id: string | null
  valor_total: number
  observacoes: string | null
  data_atualizacao: string // YYYY-MM-DD
  created_at: string
}

interface PatrimonioState {
  patrimonios: Patrimonio[]
  patrimonioAtual: Patrimonio | null
  isLoading: boolean
  error: string | null
  initialized: boolean
}

interface PatrimonioActions {
  // Inicialização
  initialize: () => Promise<void>

  // CRUD
  fetchPatrimonios: () => Promise<void>
  getPatrimonioAtual: () => Patrimonio | null
  getUltimoPatrimonio: () => Patrimonio | null
  atualizarPatrimonio: (valor: number, observacoes?: string) => Promise<Patrimonio | null>
  getHistoricoPatrimonio: (limite?: number) => Patrimonio[]

  // Cálculos
  calcularPatrimonioAtualizado: (patrimonioBase: number, transacoesPagas: { receitas: number; despesas: number }) => number
}

type PatrimonioStore = PatrimonioState & PatrimonioActions

export const usePatrimonioStore = create<PatrimonioStore>()(
  persist(
    immer((set, get) => ({
      // Estado inicial
      patrimonios: [],
      patrimonioAtual: null,
      isLoading: false,
      error: null,
      initialized: false,

      // Inicializar
      initialize: async () => {
        const { initialized } = get()

        if (initialized) {
          return
        }

        set({ isLoading: true, error: null })

        try {
          // Buscar do banco
          await get().fetchPatrimonios()

          // Pegar o mais recente
          const ultimo = get().getUltimoPatrimonio()

          set({
            patrimonioAtual: ultimo,
            initialized: true,
            isLoading: false,
          })
        } catch (error) {
          console.error('Erro ao inicializar patrimônios:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Buscar todos os patrimônios
      fetchPatrimonios: async () => {
        set({ isLoading: true, error: null })

        try {
          // TODO: Implementar quando tiver autenticação
          // Por enquanto usa localStorage
          const localPatrimonios = JSON.parse(
            localStorage.getItem('pocketwise-patrimonios') || '[]'
          ) as Patrimonio[]

          set({ patrimonios: localPatrimonios, isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar patrimônios:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Obter patrimônio atual (mais recente)
      getPatrimonioAtual: () => {
        return get().patrimonioAtual
      },

      // Obter último patrimônio da lista
      getUltimoPatrimonio: () => {
        const { patrimonios } = get()
        if (patrimonios.length === 0) return null

        // Ordenar por data de atualização (mais recente primeiro)
        const sorted = [...patrimonios].sort(
          (a, b) => new Date(b.data_atualizacao).getTime() - new Date(a.data_atualizacao).getTime()
        )

        return sorted[0]
      },

      // Atualizar patrimônio (criar novo registro)
      atualizarPatrimonio: async (valor: number, observacoes?: string) => {
        set({ isLoading: true, error: null })

        try {
          const hoje = new Date().toISOString().split('T')[0] // YYYY-MM-DD

          const novoPatrimonio: Patrimonio = {
            id: crypto.randomUUID(),
            user_id: 'local-user-id', // TODO: Usar auth real
            family_id: 'local-family-id',
            valor_total: valor,
            observacoes: observacoes || null,
            data_atualizacao: hoje,
            created_at: new Date().toISOString(),
          }

          // Salvar no localStorage
          const patrimonios = get().patrimonios
          const novosPatrimonios = [...patrimonios, novoPatrimonio]

          localStorage.setItem('pocketwise-patrimonios', JSON.stringify(novosPatrimonios))

          set((state) => {
            state.patrimonios = novosPatrimonios
            state.patrimonioAtual = novoPatrimonio
            state.isLoading = false
          })

          return novoPatrimonio
        } catch (error) {
          console.error('Erro ao atualizar patrimônio:', error)
          set({ error: (error as Error).message, isLoading: false })
          return null
        }
      },

      // Obter histórico de patrimônio (limitado)
      getHistoricoPatrimonio: (limite = 12) => {
        const { patrimonios } = get()

        // Ordenar por data (mais recente primeiro)
        const sorted = [...patrimonios].sort(
          (a, b) => new Date(b.data_atualizacao).getTime() - new Date(a.data_atualizacao).getTime()
        )

        return sorted.slice(0, limite)
      },

      // Calcular patrimônio atualizado com base nas transações
      calcularPatrimonioAtualizado: (
        patrimonioBase: number,
        transacoesPagas: { receitas: number; despesas: number }
      ) => {
        // Patrimônio Atual = Patrimônio Base + (Receitas Pagas - Despesas Pagas)
        return patrimonioBase + (transacoesPagas.receitas - transacoesPagas.despesas)
      },
    })),
    {
      name: 'pocketwise-patrimonio-store',
      partialize: (state) => ({
        patrimonios: state.patrimonios,
        patrimonioAtual: state.patrimonioAtual,
        initialized: state.initialized,
      }),
      onRehydrateStorage: () => {
        console.log('🔄 Iniciando hidratação do store de patrimônio...')
        return (state, error) => {
          if (error) {
            console.error('❌ Erro ao hidratar store de patrimônio:', error)
            try {
              localStorage.removeItem('pocketwise-patrimonio-store')
              console.log('🗑️ Storage de patrimônio corrompido foi limpo')
            } catch (e) {
              console.error('Erro ao limpar storage:', e)
            }
            return
          }

          if (state) {
            try {
              // Garantir que patrimonios é um array
              if (!Array.isArray(state.patrimonios)) {
                console.warn('⚠️ Patrimonios não é um array, resetando...')
                state.patrimonios = []
                state.patrimonioAtual = null
                state.initialized = false
              }

              console.log(
                `✅ Store de patrimônio hidratado com ${state.patrimonios.length} registros`
              )
            } catch (validationError) {
              console.error('❌ Erro ao validar dados hidratados:', validationError)
              state.patrimonios = []
              state.patrimonioAtual = null
              state.initialized = false
            }
          }
        }
      },
    }
  )
)
