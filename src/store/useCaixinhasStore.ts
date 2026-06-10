import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  Caixinha,
  CaixinhaComDetalhes,
  TransacaoCaixinha,
  CreateCaixinhaInput,
  UpdateCaixinhaInput,
  AtualizarValorMercadoInput,
  CreateTransacaoCaixinhaInput,
  AlocarSaldoMensalInput,
  CaixinhasSummary,
  TransferirEntreCaixinhasInput,
} from '../types'
import { caixinhasService, transacoesCaixinhasService } from '../services/caixinhasService'
import { useContasBancariasStore } from './useContasBancariasStore'
import { db } from '../services/database'

interface CaixinhasState {
  // Caixinhas
  caixinhas: CaixinhaComDetalhes[]

  // Transações
  transacoes: Record<string, TransacaoCaixinha[]> // Mapeado por caixinha_id
  todasTransacoesFamily: TransacaoCaixinha[] // Todas as transações da família (incl. caixinhas inativas)

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

  // Histórico em memória de atualizações de valor de mercado (por caixinha_id)
  historicoCotacoes: Record<string, Array<{ valor_anterior: number; novo_valor: number; data: string }>>
}

interface CaixinhasActions {
  // Inicialização
  initialize: () => Promise<void>

  // Caixinhas
  fetchCaixinhas: () => Promise<void>
  fetchCaixinhaById: (id: string) => Promise<CaixinhaComDetalhes | null>
  createCaixinha: (input: CreateCaixinhaInput) => Promise<Caixinha | null>
  updateCaixinha: (input: UpdateCaixinhaInput) => Promise<Caixinha | null>
  updateStatus: (id: string, status: 'ativa' | 'pausada' | 'concluida') => Promise<boolean>
  deleteCaixinha: (id: string) => Promise<boolean>
  atualizarValorMercado: (input: AtualizarValorMercadoInput) => Promise<Caixinha | null>
  reverterCotacao: (caixinhaId: string, valorAnterior: number) => Promise<boolean>

  // Summary
  fetchSummary: () => Promise<void>

  // Transações
  fetchTransacoes: (caixinhaId: string) => Promise<void>
  fetchAllTransacoesFamily: () => Promise<void>
  createTransacao: (input: CreateTransacaoCaixinhaInput) => Promise<TransacaoCaixinha | null>
  deleteTransacao: (transacaoId: string, caixinhaId: string, transacaoInfo?: { tipo: string; valor: number }) => Promise<boolean>
  alocarSaldoMensal: (input: AlocarSaldoMensalInput) => Promise<boolean>
  transferirCaixinhas: (input: TransferirEntreCaixinhasInput) => Promise<boolean>

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
  todasTransacoesFamily: [],
  summary: null,
  isLoadingCaixinhas: false,
  isLoadingTransacoes: false,
  isLoadingSummary: false,
  error: null,
  initialized: false,
  historicoCotacoes: {},
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

    updateStatus: async (id: string, status: 'ativa' | 'pausada' | 'concluida') => {
      set({ error: null })

      try {
        const { data, error } = await caixinhasService.updateStatus(id, status)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          await Promise.all([get().fetchCaixinhas(), get().fetchSummary()])
          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao atualizar status da caixinha:', error)
        set({ error: (error as Error).message })
        return false
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

    atualizarValorMercado: async (input: AtualizarValorMercadoInput) => {
      set({ error: null })

      try {
        // Capturar valor anterior para o histórico
        const caixinhaAtual = get().caixinhas.find((c) => c.id === input.caixinha_id)
        const valorAnterior = caixinhaAtual?.valor_mercado ?? caixinhaAtual?.saldo_atual ?? 0

        const { data, error } = await caixinhasService.atualizarValorMercado(input)

        if (error) {
          set({ error: error.message })
          return null
        }

        if (data) {
          // Atualizar a caixinha no estado local
          set((state) => {
            const index = state.caixinhas.findIndex((c) => c.id === input.caixinha_id)
            if (index !== -1) {
              state.caixinhas[index] = { ...state.caixinhas[index], ...data }
            }

            // Salvar no histórico em memória (últimas 5 entradas)
            const historico = state.historicoCotacoes[input.caixinha_id] || []
            state.historicoCotacoes[input.caixinha_id] = [
              { valor_anterior: valorAnterior, novo_valor: input.novo_valor_mercado, data: new Date().toISOString() },
              ...historico,
            ].slice(0, 5)
          })

          // Atualizar summary para refletir nova rentabilidade
          await get().fetchSummary()

          // Sincronizar conta bancária vinculada buscando valor atualizado do servidor.
          // Não usamos updateConta aqui pois o serviço já atualizou o DB corretamente;
          // usar o saldo local (possivelmente stale) + delta sobrescreveria o valor correto.
          const caixinhaAtualizada = get().caixinhas.find((c) => c.id === input.caixinha_id)
          if (caixinhaAtualizada?.conta_investimento_id) {
            const contasStore = useContasBancariasStore.getState()
            await contasStore.fetchContas()
          }

          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao atualizar valor de mercado:', error)
        set({ error: (error as Error).message })
        return null
      }
    },

    reverterCotacao: async (caixinhaId: string, valorAnterior: number) => {
      set({ error: null })

      try {
        const { data, error } = await caixinhasService.atualizarValorMercado({
          caixinha_id: caixinhaId,
          novo_valor_mercado: valorAnterior,
        })

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          set((state) => {
            // Atualizar caixinha
            const index = state.caixinhas.findIndex((c) => c.id === caixinhaId)
            if (index !== -1) {
              state.caixinhas[index] = { ...state.caixinhas[index], ...data }
            }
            // Remover a última entrada do histórico
            const historico = state.historicoCotacoes[caixinhaId] || []
            state.historicoCotacoes[caixinhaId] = historico.slice(1)
          })

          await get().fetchSummary()

          const caixinha = get().caixinhas.find((c) => c.id === caixinhaId)
          if (caixinha?.conta_investimento_id) {
            const contasStore = useContasBancariasStore.getState()
            await contasStore.fetchContas()
          }

          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao reverter cotação:', error)
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

    fetchAllTransacoesFamily: async () => {
      try {
        const { data, error } = await transacoesCaixinhasService.getAllTransacoesFamilia()
        if (!error && data) {
          set({ todasTransacoesFamily: data })
        }
      } catch (error) {
        console.error('Erro ao buscar todas as transações da família:', error)
      }
    },

    createTransacao: async (input: CreateTransacaoCaixinhaInput) => {
      set({ error: null })

      try {
        const { data, error } = await transacoesCaixinhasService.createTransacao(input)

        if (error) {
          console.error('Erro ao criar transação de caixinha:', error.message)
          set({ error: error.message })
          return null
        }

        if (data) {
          // Recarregar tudo afetado
          await Promise.all([
            get().fetchCaixinhas(),
            get().fetchTransacoes(input.caixinha_id),
            get().fetchSummary(),
            get().fetchAllTransacoesFamily(),
          ])

          // Depósito de orçamento em caixinha de investimento: atualizar saldos das contas.
          // Sempre via delta atômico (RPC) — nunca gravar saldo absoluto calculado
          // de estado local, que pode estar desatualizado.
          const ehDepositoDeOrcamento = input.tipo === 'deposito' && !!input.origem_mes_referencia
          if (ehDepositoDeOrcamento) {
            const caixinhaDeposito = get().caixinhas.find((c) => c.id === input.caixinha_id)
            if (caixinhaDeposito?.tipo === 'investimento' && caixinhaDeposito.conta_investimento_id) {
              // 1. Diminuir saldo da conta de saída (se informada pelo usuário)
              if (input.conta_saida_id) {
                await db.contas.ajustarSaldoDelta(input.conta_saida_id, -input.valor)
              }

              // 2. Creditar a conta de investimento vinculada:
              //    - Com cotação definida, via atualizarValorMercado, que incrementa
              //      valor_mercado junto com o saldo da conta. Sem isso, a próxima
              //      atualização de cotação re-aplicaria o aporte como "delta" na
              //      conta, contando-o duas vezes.
              //    - Sem cotação, delta direto na conta (a baseline de mercado
              //      continua sendo saldo_atual, que o trigger já incrementou).
              if (caixinhaDeposito.valor_mercado !== null && caixinhaDeposito.valor_mercado !== undefined) {
                await caixinhasService.atualizarValorMercado({
                  caixinha_id: input.caixinha_id,
                  novo_valor_mercado: caixinhaDeposito.valor_mercado + input.valor,
                })
                await get().fetchCaixinhas()
              } else {
                await db.contas.ajustarSaldoDelta(caixinhaDeposito.conta_investimento_id, input.valor)
              }

              // 3. Refrescar contas do servidor para garantir consistência
              await useContasBancariasStore.getState().fetchContas()
            }
          }

          // Retirada de caixinha de investimento: auto-ajustar valor_mercado para preservar rentabilidade
          if (input.tipo === 'retirada') {
            const caixinhaAtualizada = get().caixinhas.find((c) => c.id === input.caixinha_id)
            if (caixinhaAtualizada && caixinhaAtualizada.tipo === 'investimento') {
              if (caixinhaAtualizada.valor_mercado !== null && caixinhaAtualizada.valor_mercado !== undefined) {
                // Subtração simples: preserva o ganho não realizado existente.
                // O serviço debita a conta de investimento vinculada pelo delta.
                const novoValorMercado = Math.max(0, caixinhaAtualizada.valor_mercado - input.valor)
                await get().atualizarValorMercado({
                  caixinha_id: input.caixinha_id,
                  novo_valor_mercado: novoValorMercado,
                })
              } else if (caixinhaAtualizada.conta_investimento_id) {
                // Sem cotação definida: debitar a conta de investimento diretamente.
                // Antes este caso era pulado e a retirada creditava o destino sem
                // debitar o investimento (dinheiro duplicado no patrimônio).
                await db.contas.ajustarSaldoDelta(caixinhaAtualizada.conta_investimento_id, -input.valor)
              }
            }
          }

          // Creditar conta de destino ao retirar de caixinha de investimento
          if (input.tipo === 'retirada' && input.conta_destino_id) {
            await db.contas.ajustarSaldoDelta(input.conta_destino_id, input.valor)
            await useContasBancariasStore.getState().fetchContas()
          }

          return data
        }

        return null
      } catch (error) {
        console.error('Erro ao criar transação:', error)
        set({ error: (error as Error).message })
        return null
      }
    },

    deleteTransacao: async (transacaoId: string, caixinhaId: string, transacaoInfo?: { tipo: string; valor: number }) => {
      set({ error: null })

      try {
        // Resolver dados da transação: usar o que foi passado ou buscar no estado local
        const infoResolvida = transacaoInfo
          ?? (get().transacoes[caixinhaId] || []).find((t) => t.id === transacaoId)
        const caixinha = get().caixinhas.find((c) => c.id === caixinhaId)

        const { data, error } = await transacoesCaixinhasService.deleteTransacao(transacaoId)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Se foi uma retirada de caixinha de investimento, restaurar valor_mercado.
          // O trigger do DB já restaurou saldo_atual; sem isso valor_mercado ficaria menor
          // que saldo_atual causando rentabilidade negativa incorreta.
          if (
            infoResolvida?.tipo === 'retirada' &&
            caixinha?.tipo === 'investimento' &&
            caixinha.valor_mercado !== null
          ) {
            await get().atualizarValorMercado({
              caixinha_id: caixinhaId,
              novo_valor_mercado: caixinha.valor_mercado + infoResolvida.valor,
            })
          }

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
            get().fetchAllTransacoesFamily(),
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

    transferirCaixinhas: async (input: TransferirEntreCaixinhasInput) => {
      set({ error: null })

      try {
        const { data, error } = await caixinhasService.transferirEntreCaixinhas(input)

        if (error) {
          set({ error: error.message })
          return false
        }

        if (data) {
          // Ajustar contas bancárias se source e dest têm contas DIFERENTES
          const sourceLocal = get().caixinhas.find((c) => c.id === input.source_id)
          const destLocal = get().caixinhas.find((c) => c.id === input.dest_id)
          const sourceContaId = sourceLocal?.conta_investimento_id
          const destContaId = destLocal?.conta_investimento_id

          if (sourceContaId !== destContaId) {
            // Deltas atômicos via RPC — nunca gravar saldo absoluto de estado local
            if (sourceContaId) {
              await db.contas.ajustarSaldoDelta(sourceContaId, -input.valor_mercado_transferir)
            }
            if (destContaId) {
              await db.contas.ajustarSaldoDelta(destContaId, input.valor_mercado_transferir)
            }
            await useContasBancariasStore.getState().fetchContas()
          }

          await Promise.all([
            get().fetchCaixinhas(),
            get().fetchTransacoes(input.source_id),
            get().fetchTransacoes(input.dest_id),
            get().fetchSummary(),
          ])

          return true
        }

        return false
      } catch (error) {
        console.error('Erro ao transferir entre caixinhas:', error)
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
