import type { Lancamento } from '../types'

/**
 * Calcula o saldo REAL (apenas transações com status='pago' até hoje)
 */
export function calcularSaldoReal(lancamentos: Lancamento[]): {
  receitasRecebidas: number
  despesasPagas: number
  saldoReal: number
} {
  const hoje = new Date()
  hoje.setHours(23, 59, 59, 999) // Fim do dia de hoje

  const lancamentosPagos = lancamentos.filter((l) => {
    const dataLancamento = new Date(l.data)
    return l.status === 'pago' && dataLancamento <= hoje
  })

  const receitasRecebidas = lancamentosPagos
    .filter((l) => l.tipo === 'receita')
    .reduce((sum, l) => sum + l.valor, 0)

  const despesasPagas = lancamentosPagos
    .filter((l) => l.tipo === 'despesa')
    .reduce((sum, l) => sum + l.valor, 0)

  const saldoReal = receitasRecebidas - despesasPagas

  return {
    receitasRecebidas,
    despesasPagas,
    saldoReal,
  }
}

/**
 * Calcula o saldo PROJETADO (todas as transações: pagas + pendentes + projetadas)
 */
export function calcularSaldoProjetado(
  lancamentos: Lancamento[],
  dataInicio?: Date,
  dataFim?: Date
): {
  receitasTotal: number
  despesasTotal: number
  saldoProjetado: number
} {
  let lancamentosFiltrados = lancamentos

  // Filtrar por período se fornecido
  if (dataInicio && dataFim) {
    lancamentosFiltrados = lancamentos.filter((l) => {
      const dataLancamento = new Date(l.data_vencimento_fatura || l.data)
      return dataLancamento >= dataInicio && dataLancamento <= dataFim
    })
  }

  const receitasTotal = lancamentosFiltrados
    .filter((l) => l.tipo === 'receita')
    .reduce((sum, l) => sum + l.valor, 0)

  const despesasTotal = lancamentosFiltrados
    .filter((l) => l.tipo === 'despesa')
    .reduce((sum, l) => sum + l.valor, 0)

  const saldoProjetado = receitasTotal - despesasTotal

  return {
    receitasTotal,
    despesasTotal,
    saldoProjetado,
  }
}

/**
 * Calcula faturas de cartão do período
 */
export function calcularFaturasCartao(
  lancamentos: Lancamento[],
  dataInicio?: Date,
  dataFim?: Date
): number {
  let lancamentosFiltrados = lancamentos

  if (dataInicio && dataFim) {
    lancamentosFiltrados = lancamentos.filter((l) => {
      const dataLancamento = new Date(l.data_vencimento_fatura || l.data)
      return dataLancamento >= dataInicio && dataLancamento <= dataFim
    })
  }

  return lancamentosFiltrados
    .filter((l) => l.tipo === 'despesa' && l.cartao_id)
    .reduce((sum, l) => sum + l.valor, 0)
}

/**
 * Filtra lançamentos por período
 */
export function filtrarPorPeriodo(
  lancamentos: Lancamento[],
  dataInicio: Date,
  dataFim: Date
): Lancamento[] {
  return lancamentos.filter((l) => {
    const dataLancamento = new Date(l.data_vencimento_fatura || l.data)
    return dataLancamento >= dataInicio && dataLancamento <= dataFim
  })
}

/**
 * Calcula percentual de economia vs meta
 */
export function calcularPercentualEconomia(
  saldoReal: number,
  metaPoupanca: number
): {
  percentual: number
  status: 'atingiu' | 'acima' | 'abaixo'
} {
  if (metaPoupanca === 0) {
    return { percentual: 0, status: 'abaixo' }
  }

  const percentual = (saldoReal / metaPoupanca) * 100

  let status: 'atingiu' | 'acima' | 'abaixo'
  if (percentual >= 100) {
    status = percentual > 110 ? 'acima' : 'atingiu'
  } else {
    status = 'abaixo'
  }

  return { percentual, status }
}
