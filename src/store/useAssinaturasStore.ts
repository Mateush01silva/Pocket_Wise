import { create } from 'zustand'
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
import { useCartoesStore } from './useCartoesStore'

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
  atualizarLancamentosFuturosCompleto: (assinaturaId: string, assinatura: Assinatura, apartirDe: string) => Promise<void>

  // Sincronização de lançamentos
  sincronizarLancamentosAssinaturas: (mesReferencia?: Date) => Promise<{ criados: number; assinaturas: string[] }>

  // Regenerar todos os lançamentos de assinaturas
  regenerarTodosLancamentosAssinaturas: () => Promise<{ removidos: number; criados: number; assinaturas: string[] }>
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
        // Sempre buscar do banco para garantir sincronização
        // (evita conflito entre Zustand persist e localStorage do database)
        set({ isLoading: true, error: null })
        try {
          const { data, error } = await db.assinaturas.getAll()
          if (error) throw error
          set({ assinaturas: data || [], initialized: true, isLoading: false })
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
          const assinaturaAtual = get().getAssinaturaById(id)
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

          // Se alterou valor, cartão ou categoria, atualizar lançamentos futuros
          const hoje = format(new Date(), 'yyyy-MM-dd')
          const mudouValor = updateData.valor !== undefined && assinaturaAtual && updateData.valor !== assinaturaAtual.valor
          const mudouCartao = updateData.cartao_id !== undefined && assinaturaAtual && updateData.cartao_id !== assinaturaAtual.cartao_id
          const mudouCategoria = updateData.categoria_id !== undefined && assinaturaAtual && updateData.categoria_id !== assinaturaAtual.categoria_id

          if (mudouValor || mudouCartao || mudouCategoria) {
            console.log('🔄 Assinatura alterada, atualizando lançamentos futuros...')
            await get().atualizarLancamentosFuturosCompleto(id, data, hoje)
          }
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
        const assinaturas = get().assinaturas
        const assinaturasAtivas = assinaturas.filter((a) => a.ativa)
        const categorias = useCategoriasStore.getState().categorias
        const lancamentos = useTransacoesStore.getState().lancamentos

        // Total mensal (apenas assinaturas ativas)
        const totalMensal = assinaturasAtivas.reduce((sum, a) => {
          if (a.frequencia === 'mensal') return sum + a.valor
          return sum + a.valor / 12
        }, 0)

        // Total anual = assinaturas ativas projetadas (12 meses) + assinaturas canceladas (o que já foi pago)
        const totalAnualAtivas = totalMensal * 12

        // Calcular o que foi pago nas assinaturas canceladas nos últimos 12 meses
        const umAnoAtras = addMonths(new Date(), -12)
        const assinaturasInativas = assinaturas.filter((a) => !a.ativa)
        const totalPagoInativas = assinaturasInativas.reduce((sum, assinatura) => {
          const lancamentosAssinatura = lancamentos.filter(
            (l) =>
              l.assinatura_id === assinatura.id &&
              isAfter(parseISO(l.data), umAnoAtras)
          )
          const totalPagoAno = lancamentosAssinatura.reduce((s, l) => s + l.valor, 0)
          return sum + totalPagoAno
        }, 0)

        const totalAnual = totalAnualAtivas + totalPagoInativas

        // Assinatura mais cara (apenas ativas)
        const assinaturaMaisCara = assinaturasAtivas.reduce((max, a) => {
          const valorMensal = a.frequencia === 'mensal' ? a.valor : a.valor / 12
          const maxValorMensal = max ? (max.frequencia === 'mensal' ? max.valor : max.valor / 12) : 0
          return valorMensal > maxValorMensal ? a : max
        }, null as Assinatura | null)

        // Categoria com mais gastos (apenas ativas)
        const gastosPorCategoria = assinaturasAtivas.reduce((acc, a) => {
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
          total_assinaturas_ativas: assinaturasAtivas.length,
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
        const cartoes = useCartoesStore.getState().cartoes
        const cartao = assinatura.cartao_id ? cartoes.find(c => c.id === assinatura.cartao_id) : null

        // IMPORTANTE: forma_pagamento é baseada em ter cartao_id, não em encontrar o cartão
        const temCartao = !!assinatura.cartao_id
        const formaPagamento = temCartao ? 'credito' : 'debito'

        // CORREÇÃO: Usar a primeira_cobranca como base real, não pular para o futuro
        // A primeira cobrança deve acontecer no mês/ano da primeira_cobranca, no dia_cobranca
        let dataCobranca = setDate(dataReferencia, assinatura.dia_cobranca)
        // Se o dia do mês não existe (ex: dia 31 em fevereiro), usar último dia do mês
        if (dataCobranca.getDate() !== assinatura.dia_cobranca) {
          dataCobranca = new Date(dataCobranca.getFullYear(), dataCobranca.getMonth() + 1, 0)
        }
        let count = 0

        while (count < mesesFuturos) {
          // Calcular data de vencimento da fatura se for cartão de crédito
          let dataVencimentoFatura: string | null = null
          if (cartao) {
            // Se a compra é antes do fechamento, vence no mesmo mês
            // Se é depois do fechamento, vence no próximo mês
            const diaCompra = dataCobranca.getDate()
            let mesVencimento = dataCobranca.getMonth()
            let anoVencimento = dataCobranca.getFullYear()

            if (diaCompra > cartao.dia_fechamento) {
              // Compra após fechamento, vai para próxima fatura
              mesVencimento += 1
              if (mesVencimento > 11) {
                mesVencimento = 0
                anoVencimento += 1
              }
            }

            const dataVenc = new Date(anoVencimento, mesVencimento, cartao.dia_vencimento)
            dataVencimentoFatura = format(dataVenc, 'yyyy-MM-dd')
          }

          // Criar lançamento projetado
          const lancamentoData: CreateLancamentoInput = {
            family_id: assinatura.family_id || 'local-storage-family',
            tipo: 'despesa',
            data: format(dataCobranca, 'yyyy-MM-dd'),
            valor: assinatura.valor,
            categoria_id: assinatura.categoria_id,
            subcategoria_id: assinatura.subcategoria_id,
            observacao: assinatura.nome,
            forma_pagamento: formaPagamento,
            cartao_id: assinatura.cartao_id || null,
            data_vencimento_fatura: dataVencimentoFatura,
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

      atualizarLancamentosFuturosCompleto: async (assinaturaId, assinatura, apartirDe) => {
        console.log(`🔄 Atualizando todos os campos dos lançamentos futuros da assinatura:`, assinatura.nome)
        console.log(`📋 cartao_id da assinatura:`, assinatura.cartao_id)

        const lancamentos = useTransacoesStore.getState().lancamentos
        const updateLancamento = useTransacoesStore.getState().updateLancamento
        const cartoes = useCartoesStore.getState().cartoes
        const cartao = assinatura.cartao_id ? cartoes.find(c => c.id === assinatura.cartao_id) : null

        // IMPORTANTE: forma_pagamento é baseada em ter cartao_id, não em encontrar o cartão
        const temCartao = !!assinatura.cartao_id
        const formaPagamento = temCartao ? 'credito' : 'debito'

        console.log(`💳 Tem cartão: ${temCartao}, forma_pagamento: ${formaPagamento}`)

        const lancamentosParaAtualizar = lancamentos.filter(
          (l) =>
            l.assinatura_id === assinaturaId &&
            l.status === 'projetado' &&
            l.data >= apartirDe
        )

        console.log(`📝 Lançamentos para atualizar: ${lancamentosParaAtualizar.length}`)

        for (const lancamento of lancamentosParaAtualizar) {
          // Calcular data de vencimento da fatura se for cartão de crédito
          let dataVencimentoFatura: string | null = null
          if (cartao) {
            const dataLancamento = parseISO(lancamento.data)
            const diaCompra = dataLancamento.getDate()
            let mesVencimento = dataLancamento.getMonth()
            let anoVencimento = dataLancamento.getFullYear()

            if (diaCompra > cartao.dia_fechamento) {
              mesVencimento += 1
              if (mesVencimento > 11) {
                mesVencimento = 0
                anoVencimento += 1
              }
            }

            const dataVenc = new Date(anoVencimento, mesVencimento, cartao.dia_vencimento)
            dataVencimentoFatura = format(dataVenc, 'yyyy-MM-dd')
          }

          await updateLancamento(lancamento.id, {
            valor: assinatura.valor,
            categoria_id: assinatura.categoria_id,
            subcategoria_id: assinatura.subcategoria_id,
            cartao_id: assinatura.cartao_id || null,
            forma_pagamento: formaPagamento,
            data_vencimento_fatura: dataVencimentoFatura,
            observacao: assinatura.nome,
          })
        }

        console.log(`✅ ${lancamentosParaAtualizar.length} lançamentos atualizados com todos os campos`)
      },

      // Sincronizar lançamentos de assinaturas para um mês específico
      // Gera lançamentos faltantes para assinaturas ativas
      sincronizarLancamentosAssinaturas: async (mesReferencia = new Date()) => {
        console.log(`🔄 Sincronizando lançamentos de assinaturas para:`, format(mesReferencia, 'MMMM yyyy'))

        const assinaturas = get().assinaturas.filter(a => a.ativa)
        const lancamentos = useTransacoesStore.getState().lancamentos
        const createLancamento = useTransacoesStore.getState().createLancamento
        const cartoes = useCartoesStore.getState().cartoes

        let criados = 0
        const assinaturasAtualizadas: string[] = []

        for (const assinatura of assinaturas) {
          // Calcular a data de cobrança para o mês de referência
          const mesRef = mesReferencia.getMonth()
          const anoRef = mesReferencia.getFullYear()

          // Criar data de cobrança para o mês de referência
          let dataCobranca = new Date(anoRef, mesRef, assinatura.dia_cobranca)

          // Se o dia não existe no mês (ex: dia 31 em fevereiro), usar último dia
          if (dataCobranca.getDate() !== assinatura.dia_cobranca) {
            dataCobranca = new Date(anoRef, mesRef + 1, 0)
          }

          const dataCobrancaStr = format(dataCobranca, 'yyyy-MM-dd')

          // Verificar se a assinatura já estava ativa nesta data
          const primeiraCobranca = parseISO(assinatura.primeira_cobranca)
          if (isBefore(dataCobranca, primeiraCobranca)) {
            console.log(`⏭️ ${assinatura.nome}: Assinatura começou depois (${assinatura.primeira_cobranca})`)
            continue
          }

          // Verificar se já existe lançamento para esta assinatura neste mês
          const jaExiste = lancamentos.some(l =>
            l.assinatura_id === assinatura.id &&
            l.data.startsWith(format(mesReferencia, 'yyyy-MM'))
          )

          if (jaExiste) {
            console.log(`✓ ${assinatura.nome}: Já existe lançamento para este mês`)
            continue
          }

          // Gerar lançamento
          const cartao = assinatura.cartao_id ? cartoes.find(c => c.id === assinatura.cartao_id) : null
          const temCartao = !!assinatura.cartao_id
          const formaPagamento = temCartao ? 'credito' : 'debito'

          // Calcular data de vencimento da fatura se for cartão de crédito
          let dataVencimentoFatura: string | null = null
          if (cartao) {
            const diaCompra = dataCobranca.getDate()
            let mesVencimento = dataCobranca.getMonth()
            let anoVencimento = dataCobranca.getFullYear()

            if (diaCompra > cartao.dia_fechamento) {
              mesVencimento += 1
              if (mesVencimento > 11) {
                mesVencimento = 0
                anoVencimento += 1
              }
            }

            const dataVenc = new Date(anoVencimento, mesVencimento, cartao.dia_vencimento)
            dataVencimentoFatura = format(dataVenc, 'yyyy-MM-dd')
          }

          // Determinar status: se a data já passou, pode ser 'projetado' ou 'pendente'
          const hoje = new Date()
          const status = temCartao ? 'projetado' : (isBefore(dataCobranca, hoje) ? 'pendente' : 'projetado')

          const lancamentoData: CreateLancamentoInput = {
            family_id: assinatura.family_id || 'local-storage-family',
            tipo: 'despesa',
            data: dataCobrancaStr,
            valor: assinatura.valor,
            categoria_id: assinatura.categoria_id,
            subcategoria_id: assinatura.subcategoria_id,
            observacao: assinatura.nome,
            forma_pagamento: formaPagamento,
            cartao_id: assinatura.cartao_id || null,
            data_vencimento_fatura: dataVencimentoFatura,
            status: status,
            assinatura_id: assinatura.id,
          }

          console.log(`➕ Criando lançamento para: ${assinatura.nome} em ${dataCobrancaStr}`)
          await createLancamento(lancamentoData)
          criados++
          assinaturasAtualizadas.push(assinatura.nome)
        }

        console.log(`✅ Sincronização concluída: ${criados} lançamentos criados`)
        return { criados, assinaturas: assinaturasAtualizadas }
      },

      // Regenerar TODOS os lançamentos de assinaturas ativas
      // Remove os lançamentos projetados e gera novamente com a lógica corrigida
      regenerarTodosLancamentosAssinaturas: async () => {
        console.log('🔄 Regenerando todos os lançamentos de assinaturas...')

        const assinaturas = get().assinaturas.filter(a => a.ativa)
        const lancamentos = useTransacoesStore.getState().lancamentos
        const deleteLancamento = useTransacoesStore.getState().deleteLancamento
        const gerarLancamentosFuturos = get().gerarLancamentosFuturos

        let removidos = 0
        let criados = 0
        const assinaturasProcessadas: string[] = []

        for (const assinatura of assinaturas) {
          console.log(`📋 Processando: ${assinatura.nome}`)

          // 1. Encontrar e remover todos os lançamentos PROJETADOS desta assinatura
          const lancamentosParaRemover = lancamentos.filter(
            (l) => l.assinatura_id === assinatura.id && l.status === 'projetado'
          )

          console.log(`  🗑️ Removendo ${lancamentosParaRemover.length} lançamentos projetados`)

          for (const lancamento of lancamentosParaRemover) {
            await deleteLancamento(lancamento.id)
            removidos++
          }

          // 2. Gerar novamente os lançamentos futuros com a lógica corrigida
          console.log(`  ➕ Gerando novos lançamentos...`)
          await gerarLancamentosFuturos(assinatura, 12)
          criados += 12

          assinaturasProcessadas.push(assinatura.nome)
        }

        console.log(`✅ Regeneração concluída:`)
        console.log(`   - ${removidos} lançamentos removidos`)
        console.log(`   - ${criados} lançamentos criados`)
        console.log(`   - ${assinaturasProcessadas.length} assinaturas processadas`)

        return { removidos, criados, assinaturas: assinaturasProcessadas }
      },
    }))
  )
