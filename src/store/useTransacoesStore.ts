import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { format, addMonths, parseISO } from 'date-fns'
import type {
  Lancamento,
  CreateLancamentoInput,
  LancamentoFilters,
} from '../types'
import { db } from '../services/database'
import { useCartoesStore } from './useCartoesStore'

interface TransacoesState {
  lancamentos: Lancamento[]
  isLoading: boolean
  error: string | null
  filters: LancamentoFilters
  initialized: boolean
}

interface TransacoesActions {
  // Inicialização
  initialize: () => Promise<void>

  // CRUD
  fetchLancamentos: (filters?: LancamentoFilters) => Promise<void>
  createLancamento: (data: CreateLancamentoInput) => Promise<Lancamento | null>
  createLancamentoParcelado: (data: CreateLancamentoInput, parcelas: number) => Promise<void>
  createLancamentoRecorrente: (data: CreateLancamentoInput, meses: number) => Promise<void>
  updateLancamento: (id: string, data: Partial<Lancamento>) => Promise<void>
  deleteLancamento: (id: string) => Promise<void>
  deleteGrupoParcelas: (grupoParcelasId: string) => Promise<void>

  // Ações especiais
  marcarComoPago: (id: string) => Promise<void>
  marcarComoPendente: (id: string) => Promise<void>
  marcarFaturaComoPaga: (cartaoId: string, mesAno: string) => Promise<void>

  // Cálculos
  calcularDataVencimentoFatura: (cartaoId: string, dataTransacao: string) => string | null

  // Manutenção
  atualizarDataVencimentoFaturaAntigos: () => Promise<number>
  recalcularTodasDatasFatura: () => Promise<{ atualizados: number; erros: string[] }>

  // Queries
  getLancamentosPorCategoria: (categoriaId: string) => Lancamento[]
  getLancamentosPorCartao: (cartaoId: string) => Lancamento[]
  getFaturasCartao: (cartaoId: string, mesAno: string) => Lancamento[]
  getTotalPorPeriodo: (inicio: string, fim: string, tipo: 'despesa' | 'receita') => number

  // Filtros
  setFilters: (filters: Partial<LancamentoFilters>) => void
  clearFilters: () => void
}

type TransacoesStore = TransacoesState & TransacoesActions

export const useTransacoesStore = create<TransacoesStore>()(
  immer((set, get) => ({
    // Estado inicial
    lancamentos: [],
    isLoading: false,
    error: null,
    filters: {},
    initialized: false,

      // Inicialização - sempre busca do banco para garantir sincronização
      initialize: async () => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.lancamentos.getAll()
          if (error) throw error
          set({ lancamentos: data || [], initialized: true, isLoading: false })
        } catch (error) {
          console.error('Erro ao inicializar transações:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Buscar lançamentos
      fetchLancamentos: async (filters) => {
        set({ isLoading: true, error: null })

        try {
          const currentFilters = filters || get().filters
          const { data, error } = await db.lancamentos.getAll(currentFilters)

          if (error) throw error

          set({ lancamentos: data || [], isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar lançamentos:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Criar lançamento simples
      createLancamento: async (lancamentoData) => {
        set({ isLoading: true, error: null })

        try {
          // Determinar status baseado na forma de pagamento e data
          const hoje = new Date().toISOString().split('T')[0]
          let status: 'pago' | 'pendente' | 'projetado'

          // Cartão de crédito: sempre projetado até pagar a fatura
          if (lancamentoData.cartao_id && lancamentoData.forma_pagamento === 'credito') {
            status = 'projetado'
          } else {
            // Outras formas: baseado na data (hoje/passado = pago, futuro = pendente)
            status = lancamentoData.data <= hoje ? 'pago' : 'pendente'
          }

          // Se for lançamento de cartão de crédito, calcular data de vencimento da fatura
          let dataVencimentoFatura: string | null = null
          if (lancamentoData.cartao_id && lancamentoData.forma_pagamento === 'credito') {
            dataVencimentoFatura = get().calcularDataVencimentoFatura(
              lancamentoData.cartao_id,
              lancamentoData.data
            )
          }

          const { data, error } = await db.lancamentos.create({
            ...lancamentoData,
            status: lancamentoData.status || status,
            data_vencimento_fatura: dataVencimentoFatura,
          })

          if (error) throw error
          if (!data) return null

          set((state) => {
            state.lancamentos.push(data)
            state.isLoading = false
          })

          return data
        } catch (error) {
          console.error('Erro ao criar lançamento:', error)
          set({ error: (error as Error).message, isLoading: false })
          return null
        }
      },

      // Criar lançamento parcelado (cartão de crédito)
      createLancamentoParcelado: async (lancamentoData, numeroParcelas) => {
        set({ isLoading: true, error: null })

        try {
          const grupoParcelasId = crypto.randomUUID()
          const valorParcela = lancamentoData.valor / numeroParcelas

          // Calcular data de vencimento da primeira parcela
          const dataVencimento = get().calcularDataVencimentoFatura(
            lancamentoData.cartao_id!,
            lancamentoData.data
          )

          if (!dataVencimento) {
            throw new Error('Erro ao calcular data de vencimento da fatura')
          }

          const parcelas: Lancamento[] = []

          // Criar todas as parcelas
          for (let i = 1; i <= numeroParcelas; i++) {
            // Calcular data de vencimento de cada parcela (mes a mes)
            const dataVencimentoParcela = format(
              addMonths(parseISO(dataVencimento), i - 1),
              'yyyy-MM-dd'
            )

            const parcela: CreateLancamentoInput = {
              ...lancamentoData,
              valor: valorParcela,
              observacao: `Parcela ${i}/${numeroParcelas}${lancamentoData.observacao ? ` - ${lancamentoData.observacao}` : ''}`,
              parcela_atual: i,
              parcela_total: numeroParcelas,
              grupo_parcelas_id: grupoParcelasId,
              data_vencimento_fatura: dataVencimentoParcela,
              status: 'projetado', // Todas as parcelas começam como projetadas
            }

            const { data, error } = await db.lancamentos.create(parcela)

            if (error) throw error
            if (data) parcelas.push(data)
          }

          set((state) => {
            state.lancamentos.push(...parcelas)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao criar lançamento parcelado:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Criar lançamento recorrente (repete por X meses)
      createLancamentoRecorrente: async (lancamentoData, numeroMeses) => {
        set({ isLoading: true, error: null })

        try {
          const grupoRecorrenciaId = crypto.randomUUID()
          const transacoes: Lancamento[] = []

          // Criar transação para cada mês
          for (let i = 0; i < numeroMeses; i++) {
            // Calcular data da transação para cada mês
            const dataTransacao = format(
              addMonths(parseISO(lancamentoData.data), i),
              'yyyy-MM-dd'
            )

            // Determinar status baseado na data
            const hoje = new Date().toISOString().split('T')[0]
            let status: 'pago' | 'pendente' | 'projetado'

            if (lancamentoData.cartao_id && lancamentoData.forma_pagamento === 'credito') {
              status = 'projetado'
            } else {
              status = dataTransacao <= hoje ? 'pago' : 'pendente'
            }

            // Calcular data de vencimento da fatura se for cartão
            let dataVencimentoFatura: string | null = null
            if (lancamentoData.cartao_id && lancamentoData.forma_pagamento === 'credito') {
              dataVencimentoFatura = get().calcularDataVencimentoFatura(
                lancamentoData.cartao_id,
                dataTransacao
              )
            }

            const transacao: CreateLancamentoInput = {
              ...lancamentoData,
              data: dataTransacao,
              observacao: `${lancamentoData.observacao || ''} (Recorrente ${i + 1}/${numeroMeses})`.trim(),
              grupo_parcelas_id: grupoRecorrenciaId, // Usar mesmo campo para agrupar
              status,
              data_vencimento_fatura: dataVencimentoFatura,
            }

            const { data, error } = await db.lancamentos.create(transacao)

            if (error) throw error
            if (data) transacoes.push(data)
          }

          set((state) => {
            state.lancamentos.push(...transacoes)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao criar lançamento recorrente:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Atualizar lançamento
      updateLancamento: async (id, updateData) => {
        set({ isLoading: true, error: null })

        try {
          const { data, error } = await db.lancamentos.update({ id, ...updateData })

          if (error) throw error
          if (!data) return

          set((state) => {
            const index = state.lancamentos.findIndex((l) => l.id === id)
            if (index !== -1) {
              state.lancamentos[index] = data
            }
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao atualizar lançamento:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Deletar lançamento
      deleteLancamento: async (id) => {
        set({ isLoading: true, error: null })

        try {
          const { error } = await db.lancamentos.delete(id)

          if (error) throw error

          set((state) => {
            state.lancamentos = state.lancamentos.filter((l) => l.id !== id)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao deletar lançamento:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Deletar grupo de parcelas
      deleteGrupoParcelas: async (grupoParcelasId) => {
        set({ isLoading: true, error: null })

        try {
          const { lancamentos } = get()
          const parcelasParaDeletar = lancamentos.filter(
            (l) => l.grupo_parcelas_id === grupoParcelasId
          )

          for (const parcela of parcelasParaDeletar) {
            await db.lancamentos.delete(parcela.id)
          }

          set((state) => {
            state.lancamentos = state.lancamentos.filter(
              (l) => l.grupo_parcelas_id !== grupoParcelasId
            )
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao deletar grupo de parcelas:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // Marcar como pago
      marcarComoPago: async (id) => {
        await get().updateLancamento(id, { status: 'pago' })
      },

      // Marcar como pendente
      marcarComoPendente: async (id) => {
        await get().updateLancamento(id, { status: 'pendente' })
      },

      // Marcar fatura inteira como paga
      marcarFaturaComoPaga: async (cartaoId, mesAno) => {
        const faturas = get().getFaturasCartao(cartaoId, mesAno)

        for (const fatura of faturas) {
          await get().updateLancamento(fatura.id, { status: 'pago' })
        }
      },

      // Calcular data de vencimento da fatura
      calcularDataVencimentoFatura: (cartaoId, dataTransacao) => {
        const cartoes = useCartoesStore.getState().cartoes
        const cartao = cartoes.find((c) => c.id === cartaoId)

        if (!cartao) return null

        const dataCompra = parseISO(dataTransacao)
        const diaCompra = dataCompra.getDate()
        const mesCompra = dataCompra.getMonth()
        const anoCompra = dataCompra.getFullYear()

        // Se comprou antes do fechamento, vence no mesmo mês
        // Se comprou depois do fechamento, vence no mês seguinte
        let mesVencimento = mesCompra
        let anoVencimento = anoCompra

        if (diaCompra > cartao.dia_fechamento) {
          // Comprou depois do fechamento, vai para próxima fatura
          mesVencimento += 1
          if (mesVencimento > 11) {
            mesVencimento = 0
            anoVencimento += 1
          }
        }

        const dataVencimento = new Date(anoVencimento, mesVencimento, cartao.dia_vencimento)
        return format(dataVencimento, 'yyyy-MM-dd')
      },

      // Queries

      getLancamentosPorCategoria: (categoriaId) => {
        return get().lancamentos.filter(
          (l) => l.categoria_id === categoriaId || l.subcategoria_id === categoriaId
        )
      },

      getLancamentosPorCartao: (cartaoId) => {
        return get().lancamentos.filter((l) => l.cartao_id === cartaoId)
      },

      getFaturasCartao: (cartaoId, mesAno) => {
        // mesAno no formato 'YYYY-MM'
        return get().lancamentos.filter((l) => {
          if (l.cartao_id !== cartaoId) return false
          if (!l.data_vencimento_fatura) return false

          const vencimentoMesAno = l.data_vencimento_fatura.substring(0, 7)
          return vencimentoMesAno === mesAno
        })
      },

      getTotalPorPeriodo: (inicio, fim, tipo) => {
        return get()
          .lancamentos.filter((l) => {
            if (l.tipo !== tipo) return false
            if (l.data < inicio || l.data > fim) return false
            return true
          })
          .reduce((total, l) => total + l.valor, 0)
      },

      // Filtros

      setFilters: (newFilters) => {
        set((state) => {
          state.filters = { ...state.filters, ...newFilters }
        })
        get().fetchLancamentos()
      },

    clearFilters: () => {
      set({ filters: {} })
      get().fetchLancamentos()
    },

    // Atualizar transações antigas de cartão de crédito que não têm data_vencimento_fatura
    atualizarDataVencimentoFaturaAntigos: async () => {
      const { lancamentos, calcularDataVencimentoFatura, updateLancamento } = get()
      let atualizados = 0

      // Filtrar transações de crédito sem data_vencimento_fatura
      const transacoesSemVencimento = lancamentos.filter(
        (l) => l.cartao_id && l.forma_pagamento === 'credito' && !l.data_vencimento_fatura
      )

      console.log(`Encontradas ${transacoesSemVencimento.length} transações de crédito sem data de vencimento`)

      for (const transacao of transacoesSemVencimento) {
        const dataVencimento = calcularDataVencimentoFatura(transacao.cartao_id!, transacao.data)

        if (dataVencimento) {
          await updateLancamento(transacao.id, { data_vencimento_fatura: dataVencimento })
          atualizados++
        }
      }

      console.log(`${atualizados} transações atualizadas com data de vencimento da fatura`)
      return atualizados
    },

    // Recalcular data_vencimento_fatura de TODAS as transações de crédito
    recalcularTodasDatasFatura: async () => {
      const { lancamentos, calcularDataVencimentoFatura, updateLancamento } = get()
      let atualizados = 0
      const erros: string[] = []

      // Filtrar TODAS as transações de crédito com cartão
      const transacoesCredito = lancamentos.filter(
        (l) => l.cartao_id && l.forma_pagamento === 'credito'
      )

      console.log(`Recalculando data de fatura para ${transacoesCredito.length} transações de crédito`)

      for (const transacao of transacoesCredito) {
        // Calcular a data de vencimento base (primeira fatura)
        const dataVencimentoBase = calcularDataVencimentoFatura(transacao.cartao_id!, transacao.data)

        if (!dataVencimentoBase) {
          erros.push(`Transação ${transacao.id}: cartão não encontrado`)
          continue
        }

        // Se é uma parcela, adicionar (parcela_atual - 1) meses à data base
        // Ex: Parcela 1/3 = data base, Parcela 2/3 = +1 mês, Parcela 3/3 = +2 meses
        let dataVencimentoCorreta = dataVencimentoBase
        if (transacao.parcela_atual && transacao.parcela_atual > 1) {
          const mesesAdicionais = transacao.parcela_atual - 1
          dataVencimentoCorreta = format(
            addMonths(parseISO(dataVencimentoBase), mesesAdicionais),
            'yyyy-MM-dd'
          )
        }

        // Só atualiza se estiver diferente
        if (transacao.data_vencimento_fatura !== dataVencimentoCorreta) {
          console.log(`Corrigindo: ${transacao.observacao || 'Sem descrição'} - ${transacao.data}`)
          console.log(`  Parcela: ${transacao.parcela_atual || 'N/A'}/${transacao.parcela_total || 'N/A'}`)
          console.log(`  Antes: ${transacao.data_vencimento_fatura} → Depois: ${dataVencimentoCorreta}`)

          await updateLancamento(transacao.id, { data_vencimento_fatura: dataVencimentoCorreta })
          atualizados++
        }
      }

      console.log(`${atualizados} transações corrigidas`)
      return { atualizados, erros }
    },
  }))
)
