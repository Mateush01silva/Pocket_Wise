/**
 * Budget Calculations Library
 *
 * Funções de cálculo para sistema de orçamentos e envelopes digitais
 */

import {
  startOfMonth,
  endOfMonth,
  parseISO,
  differenceInDays,
  format,
} from 'date-fns'
import type {
  OrcamentoMensal,
  CategoriaBudget,
  Lancamento,
  SaldoAtual,
  ProjecaoMensal,
  SaudeFinanceira,
  SimulacaoCompra,
  EnvelopeDigital,
  Categoria,
  ComparativoCategoria,
  CategoriaEmRisco,
  TipoAlerta,
} from '../types'
import { formatCurrency } from '../utils/currency'

// =====================================================
// UTILITÁRIOS
// =====================================================

/**
 * Calcula o gasto total de uma categoria em um determinado mês
 */
export function calcularGastoPorCategoria(
  lancamentos: Lancamento[],
  categoriaId: string,
  mesReferencia: string
): number {
  const anoMes = mesReferencia.substring(0, 7) // YYYY-MM

  return lancamentos
    .filter((l) => {
      const lancamentoMes = l.data.substring(0, 7)
      return (
        l.tipo === 'despesa' &&
        l.categoria_id === categoriaId &&
        lancamentoMes === anoMes &&
        l.status === 'pago'
      )
    })
    .reduce((sum, l) => sum + l.valor, 0)
}

/**
 * Determina a saúde financeira baseada no uso do orçamento
 */
export function calcularSaudeFinanceira(
  percentualOrcamentoUsado: number,
  percentualMesDecorrido: number
): SaudeFinanceira {
  // Se gastou menos que o proporcional do mês, está saudável
  if (percentualOrcamentoUsado <= percentualMesDecorrido) {
    return 'saudavel'
  }

  // Se passou de 80% do orçamento
  if (percentualOrcamentoUsado >= 80) {
    return 'critico'
  }

  // Entre 60-80% = atenção
  if (percentualOrcamentoUsado >= 60) {
    return 'atencao'
  }

  return 'saudavel'
}

/**
 * Calcula saldo atual (receitas recebidas - despesas pagas)
 */
export function calcularSaldoAtual(lancamentos: Lancamento[]): SaldoAtual {
  const hoje = format(new Date(), 'yyyy-MM-dd')

  const receitasRecebidas = lancamentos
    .filter((l) => l.tipo === 'receita' && l.status === 'pago' && l.data <= hoje)
    .reduce((sum, l) => sum + l.valor, 0)

  const despesasPagas = lancamentos
    .filter((l) => l.tipo === 'despesa' && l.status === 'pago' && l.data <= hoje)
    .reduce((sum, l) => sum + l.valor, 0)

  return {
    valor: receitasRecebidas - despesasPagas,
    receitas_recebidas: receitasRecebidas,
    despesas_pagas: despesasPagas,
    data_calculo: new Date().toISOString(),
  }
}

/**
 * Calcula projeção para fim do mês
 */
export function calcularProjecaoMensal(
  orcamento: OrcamentoMensal,
  categoriasBudget: CategoriaBudget[],
  lancamentos: Lancamento[],
  categorias?: Categoria[]
): ProjecaoMensal {
  const hoje = new Date()
  const mesRefParsed = parseISO(orcamento.mes_referencia)
  const inicioMes = startOfMonth(mesRefParsed)
  const fimMes = endOfMonth(mesRefParsed)
  const diasMes = differenceInDays(fimMes, inicioMes) + 1
  const diasDecorridos = Math.max(0, differenceInDays(hoje, inicioMes) + 1)
  const percentualMesDecorrido = Math.min((diasDecorridos / diasMes) * 100, 100)

  // Filtrar lançamentos do mês
  const anoMes = orcamento.mes_referencia.substring(0, 7)
  const lancamentosDoMes = lancamentos.filter((l) => l.data.substring(0, 7) === anoMes)

  // Calculo saldo atual
  const saldoAtual = calcularSaldoAtual(lancamentos)

  // Receitas futuras (pendentes e projetadas do mês)
  const receitasFuturas = lancamentosDoMes
    .filter((l) => l.tipo === 'receita' && l.status !== 'pago' && l.data >= format(hoje, 'yyyy-MM-dd'))
    .reduce((sum, l) => sum + l.valor, 0)

  // Despesas futuras confirmadas (lançadas mas não pagas)
  const despesasFuturasConfirmadas = lancamentosDoMes
    .filter((l) => l.tipo === 'despesa' && l.status === 'pendente' && l.data >= format(hoje, 'yyyy-MM-dd'))
    .reduce((sum, l) => sum + l.valor, 0)

  // Filtrar apenas categorias de DESPESA para o cálculo do orçamento
  // Isso evita que receitas orçadas sejam contabilizadas como despesas
  const categoriasBudgetDespesa = categorias
    ? categoriasBudget.filter((cb) => {
        const categoria = categorias.find((c) => c.id === cb.categoria_id)
        return categoria?.tipo === 'despesa'
      })
    : categoriasBudget

  // Despesas orçadas mas não lançadas (considerando apenas categorias de despesa)
  const totalOrcado = categoriasBudgetDespesa.reduce((sum, cb) => sum + cb.valor_orcado, 0)
  const totalGasto = lancamentosDoMes
    .filter((l) => l.tipo === 'despesa' && l.status === 'pago')
    .reduce((sum, l) => sum + l.valor, 0)
  const despesasOrcadasNaoLancadas = Math.max(0, totalOrcado - totalGasto - despesasFuturasConfirmadas)

  // Saldo projetado fim do mês
  const saldoProjetadoFimMes =
    saldoAtual.valor + receitasFuturas - despesasFuturasConfirmadas - despesasOrcadasNaoLancadas

  // Calcular percentual de orçamento usado
  const percentualOrcamentoUsado = totalOrcado > 0 ? (totalGasto / totalOrcado) * 100 : 0

  // Saúde financeira
  const saude = calcularSaudeFinanceira(percentualOrcamentoUsado, percentualMesDecorrido)

  return {
    saldo_atual: saldoAtual.valor,
    receitas_futuras: receitasFuturas,
    despesas_futuras_confirmadas: despesasFuturasConfirmadas,
    despesas_orcadas_nao_lancadas: despesasOrcadasNaoLancadas,
    saldo_projetado_fim_mes: saldoProjetadoFimMes,
    saude,
    percentual_mes_decorrido: percentualMesDecorrido,
    percentual_orcamento_usado: percentualOrcamentoUsado,
  }
}

/**
 * Identifica categorias em risco (acima de 80% do orçamento)
 * Considera apenas categorias de DESPESA
 */
export function calcularCategoriasEmRisco(
  categoriasBudget: CategoriaBudget[],
  lancamentos: Lancamento[],
  categorias: Categoria[],
  mesReferencia: string
): CategoriaEmRisco[] {
  const categoriasEmRisco: CategoriaEmRisco[] = []

  // Filtrar apenas categorias de DESPESA
  const categoriasBudgetDespesa = categoriasBudget.filter((cb) => {
    const categoria = categorias.find((c) => c.id === cb.categoria_id)
    return categoria?.tipo === 'despesa'
  })

  for (const catBudget of categoriasBudgetDespesa) {
    const gastoCategoria = calcularGastoPorCategoria(lancamentos, catBudget.categoria_id, mesReferencia)
    const percentualUsado = catBudget.valor_orcado > 0 ? (gastoCategoria / catBudget.valor_orcado) * 100 : 0

    if (percentualUsado >= 80) {
      const categoria = categorias.find((c) => c.id === catBudget.categoria_id)
      if (categoria) {
        categoriasEmRisco.push({
          categoria,
          valor_orcado: catBudget.valor_orcado,
          valor_gasto: gastoCategoria,
          percentual_usado: percentualUsado,
          margem_restante: catBudget.valor_orcado - gastoCategoria,
        })
      }
    }
  }

  return categoriasEmRisco.sort((a, b) => b.percentual_usado - a.percentual_usado)
}

/**
 * Simula uma compra e verifica o impacto no orçamento
 */
export function simularCompra(
  valor: number,
  categoriaId: string,
  categoriasBudget: CategoriaBudget[],
  lancamentos: Lancamento[],
  mesReferencia: string
): SimulacaoCompra {
  const catBudget = categoriasBudget.find((cb) => cb.categoria_id === categoriaId)

  if (!catBudget) {
    return {
      pode_comprar: false,
      nivel: 'critico',
      mensagem: 'Categoria não encontrada no orçamento do mês',
      impacto_categoria: 0,
      impacto_saldo_final: valor,
      margem_restante_categoria: 0,
    }
  }

  const gastoAtual = calcularGastoPorCategoria(lancamentos, categoriaId, mesReferencia)
  const novoGasto = gastoAtual + valor
  const percentualUsadoAtual = (gastoAtual / catBudget.valor_orcado) * 100
  const percentualUsadoNovo = (novoGasto / catBudget.valor_orcado) * 100
  const margemRestante = catBudget.valor_orcado - novoGasto

  let pode_comprar = true
  let nivel: 'ok' | 'atencao' | 'critico' = 'ok'
  let mensagem = ''

  if (percentualUsadoNovo > 100) {
    pode_comprar = false
    nivel = 'critico'
    mensagem = `Não recomendado! Você estourará o orçamento em R$ ${formatCurrency(
      Math.abs(margemRestante)
    )}`
  } else if (percentualUsadoNovo >= 90) {
    nivel = 'atencao'
    mensagem = `Atenção! Sobrará apenas R$ ${formatCurrency(margemRestante)} nesta categoria`
  } else {
    mensagem = `Sim, você tem margem de R$ ${formatCurrency(margemRestante)} nesta categoria`
  }

  return {
    pode_comprar,
    nivel,
    mensagem,
    impacto_categoria: percentualUsadoNovo - percentualUsadoAtual,
    impacto_saldo_final: valor,
    margem_restante_categoria: margemRestante,
  }
}

/**
 * Gera envelopes digitais apenas para categorias de DESPESA do orçamento
 * Categorias de receita são usadas apenas para planejamento, não para envelopes
 */
export function gerarEnvelopesDigitais(
  categoriasBudget: CategoriaBudget[],
  lancamentos: Lancamento[],
  categorias: Categoria[],
  mesReferencia: string
): EnvelopeDigital[] {
  const anoMes = mesReferencia.substring(0, 7) // YYYY-MM

  // Filtrar apenas categorias de DESPESA para gerar envelopes
  const categoriasBudgetDespesa = categoriasBudget.filter((catBudget) => {
    const categoria = categorias.find((c) => c.id === catBudget.categoria_id)
    return categoria?.tipo === 'despesa'
  })

  return categoriasBudgetDespesa.map((catBudget) => {
    const categoria = categorias.find((c) => c.id === catBudget.categoria_id)!
    const valorGasto = calcularGastoPorCategoria(lancamentos, catBudget.categoria_id, mesReferencia)
    const valorDisponivel = catBudget.valor_orcado - valorGasto
    const percentualUsado = catBudget.valor_orcado > 0 ? (valorGasto / catBudget.valor_orcado) * 100 : 0

    let status: SaudeFinanceira = 'saudavel'
    if (percentualUsado > 100) status = 'critico'
    else if (percentualUsado >= 80) status = 'atencao'

    // Filtrar últimas transações do mês de referência
    const ultimasTransacoes = lancamentos
      .filter((l) =>
        l.categoria_id === catBudget.categoria_id &&
        l.tipo === 'despesa' &&
        l.data.substring(0, 7) === anoMes
      )
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
      .slice(0, 3)

    return {
      categoria,
      valor_orcado: catBudget.valor_orcado,
      valor_gasto: valorGasto,
      valor_disponivel: valorDisponivel,
      percentual_usado: percentualUsado,
      status,
      prioridade: catBudget.prioridade,
      ultimas_transacoes: ultimasTransacoes,
    }
  })
}

/**
 * Gera comparativo de planejado x realizado por categoria
 * Considera apenas categorias de DESPESA
 */
export function gerarComparativoCategoria(
  categoriasBudget: CategoriaBudget[],
  lancamentos: Lancamento[],
  categorias: Categoria[],
  mesReferencia: string
): ComparativoCategoria[] {
  // Filtrar apenas categorias de DESPESA
  const categoriasBudgetDespesa = categoriasBudget.filter((cb) => {
    const categoria = categorias.find((c) => c.id === cb.categoria_id)
    return categoria?.tipo === 'despesa'
  })

  return categoriasBudgetDespesa.map((catBudget) => {
    const categoria = categorias.find((c) => c.id === catBudget.categoria_id)!
    const valorGasto = calcularGastoPorCategoria(lancamentos, catBudget.categoria_id, mesReferencia)
    const desvio = valorGasto - catBudget.valor_orcado
    const percentualDesvio = catBudget.valor_orcado > 0 ? (desvio / catBudget.valor_orcado) * 100 : 0

    let status: 'dentro' | 'atencao' | 'estourado' = 'dentro'
    if (percentualDesvio > 0) status = 'estourado'
    else if (percentualDesvio > -20) status = 'atencao'

    return {
      categoria,
      valor_orcado: catBudget.valor_orcado,
      valor_gasto: valorGasto,
      desvio,
      percentual_desvio: percentualDesvio,
      status,
    }
  })
}

/**
 * Calcula taxa de aderência ao orçamento (% de categorias dentro do orçado)
 */
export function calcularTaxaAderencia(comparativo: ComparativoCategoria[]): number {
  if (comparativo.length === 0) return 100

  const categoriasDentro = comparativo.filter((c) => c.status === 'dentro').length
  return (categoriasDentro / comparativo.length) * 100
}

/**
 * Verifica se deve criar alerta para uma categoria
 */
export function verificarAlerta(
  categoriaId: string,
  categoriaBudget: CategoriaBudget,
  lancamentos: Lancamento[],
  mesReferencia: string
): { deve_alertar: boolean; tipo: TipoAlerta; percentual: number } | null {
  const gastoAtual = calcularGastoPorCategoria(lancamentos, categoriaId, mesReferencia)
  const percentualUsado = (gastoAtual / categoriaBudget.valor_orcado) * 100

  if (percentualUsado >= 100) {
    return { deve_alertar: true, tipo: 'categoria_100', percentual: percentualUsado }
  } else if (percentualUsado >= 90) {
    return { deve_alertar: true, tipo: 'categoria_90', percentual: percentualUsado }
  } else if (percentualUsado >= 80) {
    return { deve_alertar: true, tipo: 'categoria_80', percentual: percentualUsado }
  }

  return null
}
