import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { addMonths, format, parseISO, setDate, isBefore, isAfter } from 'date-fns'
import type {
  Assinatura,
  AssinaturaComDetalhes,
  CreateAssinaturaInput,
  UpdateAssinaturaInput,
  HistoricoValorAssinatura,
  AssinaturasSummary,
  CreateLancamentoInput,
} from '../types'
import { db } from '../services/database'
import { useTransacoesStore } from './useTransacoesStore'
import { useCategoriasStore } from './useCategoriasStore'

interface AssinaturasState {
  assinaturas: Assinatura[]
  historico: HistoricoValorAssinatura[]
  isLoading: boolean
  error: string | null
  initialized: boolean
}

interface AssinaturasActions {
  // Inicialização
  initialize: () => Promise<void>

  // CRUD Assinaturas
  fetchAssinaturas: () => Promise<void>
  createAssinatura: (data: CreateAssinaturaInput) => Promise<Assinatura | null>
  updateAssinatura: (id: string, data: Partial<UpdateAssinaturaInput>) => Promise<void>
  deleteAssinatura: (id: string) => Promise<void>
  cancelarAssinatura: (id: string, dataUltimaCobranca: string) => Promise<void>
  atualizarValor: (id: string, novoValor: number, vigenciaInicio: string) => Promise<void>

  // Histórico
  fetchHistorico: (assinaturaId: string) => Promise<void>

  // Queries computadas
  getAssinaturasComDetalhes: () => AssinaturaComDetalhes[]
  getSummary: () => AssinaturasSummary
  getAssinaturaById: (id: string) => Assinatura | null

  // Helpers - Integração com Lançamentos
  gerarLancamentosFuturos: (assinatura: Assinatura, mesesFuturos?: number) => Promise<void>
  removerLancamentosFuturos: (assinaturaId: string, apartirDe: string) => Promise<void>
  atualizarLancamentosFuturos: (assinaturaId: string, novoValor: number, apartirDe: string) => Promise<void>
}

type AssinaturasStore = AssinaturasState & AssinaturasActions

// Helper: Calcular próxima cobrança baseado no dia
function calcularProximaCobranca(diaCobranca: number, dataReferencia: Date, frequencia: 'mensal' | 'anual'): Date {
  const hoje = new Date()
  let proximaCobranca = setDate(dataReferencia, diaCobranca)

  // Se o dia do mês não existe (ex: dia 31 em fevereiro), usar último dia do mês
  if (proximaCobranca.getDate() !== diaCobranca) {
    proximaCobranca = new Date(proximaCobranca.getFullYear(), proximaCobranca.getMonth() + 1, 0)
  }

  // Se a data calculada já passou, avançar para próximo período
  while (isBefore(proximaCobranca, hoje)) {
    if (frequencia === 'mensal') {
      proximaCobranca = addMonths(proximaCobranca, 1)
      // Reajustar para o dia correto
      proximaCobranca = setDate(proximaCobranca, diaCobranca)
      if (proximaCobranca.getDate() !== diaCobranca) {
        proximaCobranca = new Date(proximaCobranca.getFullYear(), proximaCobranca.getMonth() + 1, 0)
      }
    } else {
      proximaCobranca = addMonths(proximaCobranca, 12)
      proximaCobranca = setDate(proximaCobranca, diaCobranca)
      if (proximaCobranca.getDate() !== diaCobranca) {
        proximaCobranca = new Date(proximaCobranca.getFullYear(), proximaCobranca.getMonth() + 1, 0)
      }
    }
  }

  return proximaCobranca
}

export const useAssinaturasStore = create<AssinaturasStore>()(
  persist(
    immer((set, get) => ({
      // Estado inicial
      assinaturas: [],
      historico: [],
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
          await get().fetchAssinaturas()
          set({ initialized: true, isLoading: false })
        } catch (error) {
          console.error('Erro ao inicializar assinaturas:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // =====================================================
      // CRUD ASSINATURAS
      // =====================================================

      fetchAssinaturas: async () => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.assinaturas.getAll()
          if (error) throw error
          set({ assinaturas: data || [], isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar assinaturas:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      createAssinatura: async (assinaturaData) => {
        console.log('🟢 useAssinaturasStore.createAssinatura: Iniciando com dados:', assinaturaData)
        set({ isLoading: true, error: null })
        try {
          console.log('🟢 useAssinaturasStore.createAssinatura: Chamando db.assinaturas.create')
          const { data, error } = await db.assinaturas.create(assinaturaData)
          console.log('🟢 useAssinaturasStore.createAssinatura: Resposta do DB:', { data, error })

          if (error) {
            console.error('🔴 useAssinaturasStore.createAssinatura: Erro do DB:', error)
            throw error
          }
          if (!data) {
            console.error('🔴 useAssinaturasStore.createAssinatura: Data é null')
            return null
          }

          console.log('🟢 useAssinaturasStore.createAssinatura: Adicionando à store')
          set((state) => {
            state.assinaturas.push(data)
            state.isLoading = false
          })

          // Gerar lançamentos futuros automaticamente
          // Não falhar se a geração de lançamentos falhar
          try {
            console.log('🟢 useAssinaturasStore.createAssinatura: Gerando lançamentos futuros')
            await get().gerarLancamentosFuturos(data, 12)
          } catch (lancamentoError) {
            console.error('⚠️ Erro ao gerar lançamentos futuros:', lancamentoError)
            // Assinatura já foi criada, apenas logar o erro
          }

          console.log('✅ useAssinaturasStore.createAssinatura: Sucesso! Retornando data')
          return data
        } catch (error) {
          console.error('🔴 useAssinaturasStore.createAssinatura: Erro geral:', error)
          set({ error: (error as Error).message, isLoading: false })
          return null
        }
      },

      updateAssinatura: async (id, updateData) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.assinaturas.update({ id, ...updateData })
          if (error) throw error
          if (!data) return

          set((state) => {
            const index = state.assinaturas.findIndex((a) => a.id === id)
            if (index !== -1) {
              state.assinaturas[index] = data
            }
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao atualizar assinatura:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      deleteAssinatura: async (id) => {
        set({ isLoading: true, error: null })
        try {
          // Remover lançamentos futuros vinculados
          await get().removerLancamentosFuturos(id, format(new Date(), 'yyyy-MM-dd'))

          const { error } = await db.assinaturas.delete(id)
          if (error) throw error

          set((state) => {
            state.assinaturas = state.assinaturas.filter((a) => a.id !== id)
            state.isLoading = false
          })
        } catch (error) {
          console.error('Erro ao deletar assinatura:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      cancelarAssinatura: async (id, dataUltimaCobranca) => {
        set({ isLoading: true, error: null })
        try {
          // Atualizar assinatura para inativa
          await get().updateAssinatura(id, {
            ativa: false,
            ultima_cobranca: dataUltimaCobranca,
          })

          // Remover lançamentos futuros após a última cobrança
          await get().removerLancamentosFuturos(id, dataUltimaCobranca)

          set({ isLoading: false })
        } catch (error) {
          console.error('Erro ao cancelar assinatura:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      atualizarValor: async (id, novoValor, vigenciaInicio) => {
        set({ isLoading: true, error: null })
        try {
          const assinatura = get().getAssinaturaById(id)
          if (!assinatura) {
            throw new Error('Assinatura não encontrada')
          }

          // Criar registro no histórico
          await db.historicoValorAssinaturas.create(
            id,
            assinatura.valor,
            novoValor,
            vigenciaInicio
          )

          // Atualizar valor da assinatura
          await get().updateAssinatura(id, { valor: novoValor })

          // Atualizar lançamentos futuros com o novo valor
          await get().atualizarLancamentosFuturos(id, novoValor, vigenciaInicio)

          set({ isLoading: false })
        } catch (error) {
          console.error('Erro ao atualizar valor:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // =====================================================
      // HISTÓRICO
      // =====================================================

      fetchHistorico: async (assinaturaId) => {
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.historicoValorAssinaturas.getByAssinaturaId(assinaturaId)
          if (error) throw error
          set({ historico: data || [], isLoading: false })
        } catch (error) {
          console.error('Erro ao buscar histórico:', error)
          set({ error: (error as Error).message, isLoading: false })
        }
      },

      // =====================================================
      // QUERIES COMPUTADAS
      // =====================================================

      getAssinaturasComDetalhes: () => {
        const assinaturas = get().assinaturas
        const categorias = useCategoriasStore.getState().categorias
        const lancamentos = useTransacoesStore.getState().lancamentos

        return assinaturas.map((assinatura) => {
          const categoria = categorias.find((c) => c.id === assinatura.categoria_id)

          // Calcular próxima cobrança
          const dataReferencia = parseISO(assinatura.primeira_cobranca)
          const proximaCobranca = calcularProximaCobranca(
            assinatura.dia_cobranca,
            dataReferencia,
            assinatura.frequencia
          )

          // Calcular total pago no último ano
          const umAnoAtras = addMonths(new Date(), -12)
          const lancamentosAssinatura = lancamentos.filter(
            (l) =>
              l.assinatura_id === assinatura.id &&
              isAfter(parseISO(l.data), umAnoAtras)
          )
          const totalPagoAno = lancamentosAssinatura.reduce((sum, l) => sum + l.valor, 0)

          // Contar lançamentos gerados
          const lancamentosGerados = lancamentos.filter(
            (l) => l.assinatura_id === assinatura.id
          ).length

          return {
            ...assinatura,
            categoria_nome: categoria?.nome || 'Sem categoria',
            categoria_cor: categoria?.cor || null,
            proxima_cobranca: format(proximaCobranca, 'yyyy-MM-dd'),
            total_pago_ano: totalPagoAno,
            lancamentos_gerados: lancamentosGerados,
          } as AssinaturaComDetalhes
        })
      },

      getSummary: () => {
        const assinaturas = get().assinaturas.filter((a) => a.ativa)
        const categorias = useCategoriasStore.getState().categorias

        // Total mensal (soma de todas as assinaturas mensais + anuais / 12)
        const totalMensal = assinaturas.reduce((sum, a) => {
          if (a.frequencia === 'mensal') return sum + a.valor
          return sum + a.valor / 12
        }, 0)

        // Total anual
        const totalAnual = totalMensal * 12

        // Assinatura mais cara
        const assinaturaMaisCara = assinaturas.reduce((max, a) => {
          const valorMensal = a.frequencia === 'mensal' ? a.valor : a.valor / 12
          const maxValorMensal = max ? (max.frequencia === 'mensal' ? max.valor : max.valor / 12) : 0
          return valorMensal > maxValorMensal ? a : max
        }, null as Assinatura | null)

        // Categoria com mais gastos
        const gastosPorCategoria = assinaturas.reduce((acc, a) => {
          const valorMensal = a.frequencia === 'mensal' ? a.valor : a.valor / 12
          if (!acc[a.categoria_id]) {
            acc[a.categoria_id] = { total: 0, quantidade: 0 }
          }
          acc[a.categoria_id].total += valorMensal * 12
          acc[a.categoria_id].quantidade += 1
          return acc
        }, {} as Record<string, { total: number; quantidade: number }>)

        const categoriaComMaisGastos = Object.entries(gastosPorCategoria)
          .sort(([, a], [, b]) => b.total - a.total)[0]

        const categoria = categoriaComMaisGastos
          ? categorias.find((c) => c.id === categoriaComMaisGastos[0])
          : null

        return {
          total_assinaturas_ativas: assinaturas.length,
          total_mensal: totalMensal,
          total_anual: totalAnual,
          assinatura_mais_cara: assinaturaMaisCara,
          categoria_com_mais_gastos: categoria && categoriaComMaisGastos
            ? {
                categoria,
                total: categoriaComMaisGastos[1].total,
                quantidade: categoriaComMaisGastos[1].quantidade,
              }
            : null,
        }
      },

      getAssinaturaById: (id) => {
        return get().assinaturas.find((a) => a.id === id) || null
      },

      // =====================================================
      // HELPERS - INTEGRAÇÃO COM LANÇAMENTOS
      // =====================================================

      gerarLancamentosFuturos: async (assinatura, mesesFuturos = 12) => {
        console.log(`🔄 Gerando ${mesesFuturos} lançamentos futuros para assinatura:`, assinatura.nome)

        const dataReferencia = parseISO(assinatura.primeira_cobranca)
        const createLancamento = useTransacoesStore.getState().createLancamento

        let dataCobranca = calcularProximaCobranca(assinatura.dia_cobranca, dataReferencia, assinatura.frequencia)
        let count = 0

        while (count < mesesFuturos) {
          // Criar lançamento projetado
          const lancamentoData: CreateLancamentoInput = {
            family_id: assinatura.family_id || 'local-storage-family',
            tipo: 'despesa',
            data: format(dataCobranca, 'yyyy-MM-dd'),
            valor: assinatura.valor,
            categoria_id: assinatura.categoria_id,
            subcategoria_id: assinatura.subcategoria_id,
            observacao: assinatura.nome,
            forma_pagamento: 'debito',
            status: 'projetado',
            assinatura_id: assinatura.id,
          }

          await createLancamento(lancamentoData)

          // Avançar para próxima cobrança
          if (assinatura.frequencia === 'mensal') {
            dataCobranca = addMonths(dataCobranca, 1)
            dataCobranca = setDate(dataCobranca, assinatura.dia_cobranca)
            if (dataCobranca.getDate() !== assinatura.dia_cobranca) {
              dataCobranca = new Date(dataCobranca.getFullYear(), dataCobranca.getMonth() + 1, 0)
            }
          } else {
            dataCobranca = addMonths(dataCobranca, 12)
            dataCobranca = setDate(dataCobranca, assinatura.dia_cobranca)
            if (dataCobranca.getDate() !== assinatura.dia_cobranca) {
              dataCobranca = new Date(dataCobranca.getFullYear(), dataCobranca.getMonth() + 1, 0)
            }
          }

          count++
        }

        console.log(`✅ ${count} lançamentos criados com sucesso`)
      },

      removerLancamentosFuturos: async (assinaturaId, apartirDe) => {
        console.log(`🗑️ Removendo lançamentos futuros da assinatura ${assinaturaId} a partir de ${apartirDe}`)

        const lancamentos = useTransacoesStore.getState().lancamentos
        const deleteLancamento = useTransacoesStore.getState().deleteLancamento

        const lancamentosParaRemover = lancamentos.filter(
          (l) =>
            l.assinatura_id === assinaturaId &&
            l.status === 'projetado' &&
            l.data > apartirDe
        )

        for (const lancamento of lancamentosParaRemover) {
          await deleteLancamento(lancamento.id)
        }

        console.log(`✅ ${lancamentosParaRemover.length} lançamentos removidos`)
      },

      atualizarLancamentosFuturos: async (assinaturaId, novoValor, apartirDe) => {
        console.log(`💰 Atualizando valor dos lançamentos futuros para R$ ${novoValor}`)

        const lancamentos = useTransacoesStore.getState().lancamentos
        const updateLancamento = useTransacoesStore.getState().updateLancamento

        const lancamentosParaAtualizar = lancamentos.filter(
          (l) =>
            l.assinatura_id === assinaturaId &&
            l.status === 'projetado' &&
            l.data >= apartirDe
        )

        for (const lancamento of lancamentosParaAtualizar) {
          await updateLancamento(lancamento.id, { valor: novoValor })
        }

        console.log(`✅ ${lancamentosParaAtualizar.length} lançamentos atualizados`)
      },
    })),
    {
      name: 'pocketwise-assinaturas-store',
      partialize: (state) => ({
        assinaturas: state.assinaturas,
        historico: state.historico,
      }),
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            console.error('Erro ao hidratar store de assinaturas:', error)
            try {
              localStorage.removeItem('pocketwise-assinaturas-store')
            } catch (e) {
              console.error('Erro ao limpar storage:', e)
            }
          }
        }
      },
    }
  )
)
