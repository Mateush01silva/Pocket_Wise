import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { format, startOfMonth } from 'date-fns'
import type {
  OrcamentoMensal,
  CategoriaBudget,
  CategoriaBudgetComRelacoes,
  CreateOrcamentoInput,
  UpdateOrcamentoInput,
  CreateCategoriaBudgetInput,
  BulkCategoriaBudgetInput,
  ProjecaoMensal,
  EnvelopeDigital,
  CategoriaEmRisco,
  SimulacaoCompra,
} from '../types'
import { db } from '../services/database'
import {
  calcularProjecaoMensal,
  gerarEnvelopesDigitais,
  calcularCategoriasEmRisco,
  simularCompra,
  calcularGastoPorCategoria,
} from '../lib/budgetCalculations'
import { useTransacoesStore } from './useTransacoesStore'
import { useCategoriasStore } from './useCategoriasStore'

interface OrcamentosState {
  orcamentos: OrcamentoMensal[]
  categoriasBudget: CategoriaBudget[]
  orcamentoAtual: OrcamentoMensal | null
  isLoading: boolean
  error: string | null
  initialized: boolean
}

interface OrcamentosActions {
  // Inicialização
  initialize: () => Promise<void>

  // CRUD Orçamentos
  fetchOrcamentos: () => Promise<void>
  getOrcamentoDoMes: (mesReferencia: string) => OrcamentoMensal | null
  createOrcamento: (data: CreateOrcamentoInput) => Promise<OrcamentoMensal | null>
  updateOrcamento: (id: string, data: Partial<UpdateOrcamentoInput>) => Promise<void>
  deleteOrcamento: (id: string) => Promise<void>
  setOrcamentoAtual: (orcamento: OrcamentoMensal | null) => void

  // CRUD Categorias Budget
  fetchCategoriasBudget: (orcamentoId: string) => Promise<void>
  createCategoriaBudget: (data: CreateCategoriaBudgetInput) => Promise<void>
  bulkCreateCategoriasBudget: (data: BulkCategoriaBudgetInput) => Promise<void>
  updateCategoriaBudget: (id: string, valorOrcado: number) => Promise<void>
  deleteCategoriaBudget: (id: string) => Promise<void>

  // Queries computadas
  getProjecaoMensal: (orcamentoId: string) => ProjecaoMensal | null
  getEnvelopesDigitais: (orcamentoId: string) => EnvelopeDigital[]
  getCategoriasBudgetComDados: (orcamentoId: string) => CategoriaBudgetComRelacoes[]
  getCategoriasEmRisco: (orcamentoId: string) => CategoriaEmRisco[]
  simularCompra: (valor: number, categoriaId: string, orcamentoId: string) => SimulacaoCompra | null

  // Helpers
  copiarOrcamentoMesAnterior: (mesReferencia: string) => Promise<OrcamentoMensal | null>
}

type OrcamentosStore = OrcamentosState & OrcamentosActions

export const useOrcamentosStore = create<OrcamentosStore>()(
  persist(
    immer((set, get) => ({
      // Estado inicial
      orcamentos: [],
      categoriasBudget: [],
      orcamentoAtual: null,
      isLoading: false,
      error: null,
      initialized: false,

      // =====================================================
      // INICIALIZAÇÃO
      // =====================================================

      initialize: async () => {
        if (get().initialized) return

        set({ isLoading: true })
        try {
          await get().fetchOrcamentos()

          // Buscar orçamento do mês atual
          const mesAtual = format(startOfMonth(new Date()), 'yyyy-MM-dd')
          const orcamentoMesAtual = get().getOrcamentoDoMes(mesAtual)

          if (orcamentoMesAtual) {
            set({ orcamentoAtual: orcamentoMesAtual })
            await get().fetchCategoriasBudget(orcamentoMesAtual.id)
          }

          set({ initialized: true, isLoading: false })
        } catch (error) {
          console.error('Erro ao inicializar orçamentos:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // =====================================================
      // CRUD ORÇAMENTOS
      // =====================================================

      fetchOrcamentos: async () => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.orcamentos.getAll()
          if (error) throw error
          set({ orcamentos: data || [], isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar orçamentos:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      getOrcamentoDoMes: (mesReferencia: string) => {
        const anoMes = mesReferencia.substring(0, 7)
        return get().orcamentos.find((o) => o.mes_referencia.startsWith(anoMes)) || null
      },

      createOrcamento: async (orcamentoData) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.orcamentos.create(orcamentoData)
          if (error) throw error
          if (!data) return null

          set((state) => {
            state.orcamentos.push(data)
            state.isLoading = false
          })

          return data
        } catch (error) {
          console.error('Erro ao criar orçamento:', error)
          set({ error: (error as Error).message, isLoading: false })
          return null
        }
      },

      updateOrcamento: async (id, updateData) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.orcamentos.update({ id, ...updateData })
          if (error) throw error
          if (!data) return

          set((state) => {
            const index = state.orcamentos.findIndex((o) => o.id === id)
            if (index !== -1) {
              state.orcamentos[index] = data
            }
            if (state.orcamentoAtual?.id === id) {
              state.orcamentoAtual = data
            }
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao atualizar orçamento:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteOrcamento: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const { error } = await db.orcamentos.delete(id)
          if (error) throw error

          set((state) => {
            state.orcamentos = state.orcamentos.filter((o) => o.id !== id)
            state.categoriasBudget = state.categoriasBudget.filter((cb) => cb.orcamento_id !== id)
            if (state.orcamentoAtual?.id === id) {
              state.orcamentoAtual = null
            }
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao deletar orçamento:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      setOrcamentoAtual: (orcamento) => {
        set({ orcamentoAtual: orcamento })
        if (orcamento) {
          get().fetchCategoriasBudget(orcamento.id)
        }
      },

      // =====================================================
      // CRUD CATEGORIAS BUDGET
      // =====================================================

      fetchCategoriasBudget: async (orcamentoId) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.categoriasBudget.getAll(orcamentoId)
          if (error) throw error
          set({ categoriasBudget: data || [], isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar categorias budget:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      createCategoriaBudget: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const { data: newCat, error } = await db.categoriasBudget.create(data)
          if (error) throw error
          if (!newCat) return

          set((state) => {
            state.categoriasBudget.push(newCat)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao criar categoria budget:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      bulkCreateCategoriasBudget: async (data) => {
        set({ isLoading: true, error: null })
        try {
          const { data: newCats, error } = await db.categoriasBudget.bulkCreate(data)
          if (error) throw error
          if (!newCats) return

          set((state) => {
            state.categoriasBudget.push(...newCats)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao criar categorias budget em lote:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      updateCategoriaBudget: async (id, valorOrcado) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.categoriasBudget.update({ id, valor_orcado: valorOrcado })
          if (error) throw error
          if (!data) return

          set((state) => {
            const index = state.categoriasBudget.findIndex((cb) => cb.id === id)
            if (index !== -1) {
              state.categoriasBudget[index] = data
            }
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao atualizar categoria budget:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteCategoriaBudget: async (id) => {
        set({ isLoading: true, error: null })
        try {
          const { error } = await db.categoriasBudget.delete(id)
          if (error) throw error

          set((state) => {
            state.categoriasBudget = state.categoriasBudget.filter((cb) => cb.id !== id)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao deletar categoria budget:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // =====================================================
      // QUERIES COMPUTADAS
      // =====================================================

      getProjecaoMensal: (orcamentoId) => {
        const orcamento = get().orcamentos.find((o) => o.id === orcamentoId)
        if (!orcamento) return null

        const categoriasBudget = get().categoriasBudget.filter((cb) => cb.orcamento_id === orcamentoId)
        const lancamentos = useTransacoesStore.getState().lancamentos

        return calcularProjecaoMensal(orcamento, categoriasBudget, lancamentos)
      },

      getEnvelopesDigitais: (orcamentoId) => {
        const orcamento = get().orcamentos.find((o) => o.id === orcamentoId)
        if (!orcamento) return []

        const categoriasBudget = get().categoriasBudget.filter((cb) => cb.orcamento_id === orcamentoId)
        const lancamentos = useTransacoesStore.getState().lancamentos
        const categorias = useCategoriasStore.getState().categorias

        return gerarEnvelopesDigitais(categoriasBudget, lancamentos, categorias, orcamento.mes_referencia)
      },

      getCategoriasBudgetComDados: (orcamentoId) => {
        const orcamento = get().orcamentos.find((o) => o.id === orcamentoId)
        if (!orcamento) return []

        const categoriasBudget = get().categoriasBudget.filter((cb) => cb.orcamento_id === orcamentoId)
        const lancamentos = useTransacoesStore.getState().lancamentos
        const categorias = useCategoriasStore.getState().categorias

        return categoriasBudget.map((catBudget) => {
          const categoria = categorias.find((c) => c.id === catBudget.categoria_id)
          const valorGasto = calcularGastoPorCategoria(lancamentos, catBudget.categoria_id, orcamento.mes_referencia)
          const valorDisponivel = catBudget.valor_orcado - valorGasto
          const percentualUsado = catBudget.valor_orcado > 0 ? (valorGasto / catBudget.valor_orcado) * 100 : 0

          return {
            ...catBudget,
            categoria: categoria || null,
            valor_gasto: valorGasto,
            valor_disponivel: valorDisponivel,
            percentual_usado: percentualUsado,
          }
        })
      },

      getCategoriasEmRisco: (orcamentoId) => {
        const orcamento = get().orcamentos.find((o) => o.id === orcamentoId)
        if (!orcamento) return []

        const categoriasBudget = get().categoriasBudget.filter((cb) => cb.orcamento_id === orcamentoId)
        const lancamentos = useTransacoesStore.getState().lancamentos
        const categorias = useCategoriasStore.getState().categorias

        return calcularCategoriasEmRisco(categoriasBudget, lancamentos, categorias, orcamento.mes_referencia)
      },

      simularCompra: (valor, categoriaId, orcamentoId) => {
        const orcamento = get().orcamentos.find((o) => o.id === orcamentoId)
        if (!orcamento) return null

        const categoriasBudget = get().categoriasBudget.filter((cb) => cb.orcamento_id === orcamentoId)
        const lancamentos = useTransacoesStore.getState().lancamentos

        return simularCompra(valor, categoriaId, categoriasBudget, lancamentos, orcamento.mes_referencia)
      },

      // =====================================================
      // HELPERS
      // =====================================================

      copiarOrcamentoMesAnterior: async (mesReferencia) => {
        set({ isLoading: true, error: null })
        try {
          // Buscar orçamento do mês anterior
          const [ano, mes] = mesReferencia.split('-').map(Number)
          const mesAnterior = new Date(ano, mes - 2, 1) // -2 porque mes é 1-indexed
          const mesAnteriorStr = format(mesAnterior, 'yyyy-MM-dd')

          const orcamentoAnterior = get().getOrcamentoDoMes(mesAnteriorStr)
          if (!orcamentoAnterior) {
            throw new Error('Orçamento do mês anterior não encontrado')
          }

          // Criar novo orçamento
          const novoOrcamento = await get().createOrcamento({
            family_id: orcamentoAnterior.family_id,
            mes_referencia: mesReferencia,
            meta_poupanca: orcamentoAnterior.meta_poupanca,
            meta_poupanca_percentual: orcamentoAnterior.meta_poupanca_percentual,
            dia_inicio_ciclo: orcamentoAnterior.dia_inicio_ciclo,
            metodo_calculo: orcamentoAnterior.metodo_calculo,
            status: 'rascunho',
          })

          if (!novoOrcamento) {
            throw new Error('Erro ao criar novo orçamento')
          }

          // Copiar categorias budget
          const categoriasBudgetAnterior = get().categoriasBudget.filter(
            (cb) => cb.orcamento_id === orcamentoAnterior.id
          )

          if (categoriasBudgetAnterior.length > 0) {
            await get().bulkCreateCategoriasBudget({
              orcamento_id: novoOrcamento.id,
              categorias: categoriasBudgetAnterior.map((cb) => ({
                categoria_id: cb.categoria_id,
                valor_orcado: cb.valor_orcado,
                prioridade: cb.prioridade,
              })),
            })
          }

          set({ isLoading: false })
          return novoOrcamento
        } catch (error) {
          console.error('Erro ao copiar orçamento do mês anterior:', error)
          set({ error: (error as Error).message, isLoading: false })
          return null
        }
      },
    })),
    {
      name: 'pocketwise-orcamentos-store',
      partialize: (state) => ({
        orcamentos: state.orcamentos,
        categoriasBudget: state.categoriasBudget,
      }),
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.error('Erro ao hidratar store de orçamentos:', error)
            try {
              localStorage.removeItem('pocketwise-orcamentos-store')
            } catch (e) {
              console.error('Erro ao limpar storage:', e)
            }
          }
        }
      },
    }
  )
)
