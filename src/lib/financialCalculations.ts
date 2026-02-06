import type { Lancamento, TransacaoCaixinha } from '../types'
import { startOfMonth, endOfMonth, subMonths, format, isBefore, addMonths, parseISO } from 'date-fns'

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
 * Calcula total de TODAS as faturas atuais (não pagas) de todos os cartões
 */
export function calcularFaturasAtuaisCartao(lancamentos: Lancamento[]): number {
  return lancamentos
    .filter(
      (l) =>
        l.tipo === 'despesa' &&
        l.cartao_id &&
        l.forma_pagamento === 'credito' &&
        l.status !== 'pago' // Considera pendente, projetado, etc
    )
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

/**
 * Interface para o resultado do cálculo de saldo acumulado por mês
 */
export interface SaldoMesInfo {
  mesRef: string // YYYY-MM
  saldoBruto: number // Receitas - Despesas do mês
  totalAlocado: number // Total já alocado desse mês em caixinhas
  saldoDisponivel: number // saldoBruto - totalAlocado
}

/**
 * Calcula o saldo acumulado não alocado de todos os meses passados
 * Considera todos os meses desde a primeira transação até o mês anterior
 * Para cada mês: calcula receitas - despesas - já alocado em caixinhas
 * Soma apenas os saldos positivos de cada mês
 */
export function calcularSaldoAcumuladoNaoAlocado(
  lancamentos: Lancamento[],
  transacoesCaixinhas: TransacaoCaixinha[]
): {
  totalDisponivel: number
  mesesComSaldo: SaldoMesInfo[]
} {
  if (lancamentos.length === 0) {
    return { totalDisponivel: 0, mesesComSaldo: [] }
  }

  // Encontrar a data mais antiga das transações
  const datasOrdenadas = lancamentos
    .map((l) => new Date(l.data))
    .sort((a, b) => a.getTime() - b.getTime())

  const dataInicio = startOfMonth(datasOrdenadas[0])
  const mesAnterior = subMonths(startOfMonth(new Date()), 1)

  // Se a primeira transação é do mês atual ou futuro, não há saldo passado
  if (!isBefore(dataInicio, mesAnterior)) {
    return { totalDisponivel: 0, mesesComSaldo: [] }
  }

  const mesesComSaldo: SaldoMesInfo[] = []
  let mesAtual = dataInicio

  // Iterar por todos os meses até o mês anterior
  while (isBefore(mesAtual, new Date()) && !isBefore(mesAnterior, mesAtual)) {
    const inicioMes = startOfMonth(mesAtual)
    const fimMes = endOfMonth(mesAtual)
    const mesRef = format(mesAtual, 'yyyy-MM')

    // Calcular receitas e despesas do mês
    const { saldoProjetado: saldoBruto } = calcularSaldoProjetado(
      lancamentos,
      inicioMes,
      fimMes
    )

    // Calcular total já alocado deste mês em caixinhas
    // A transação.origem_mes_referencia pode ser 'YYYY-MM-DD' ou 'YYYY-MM'
    const totalAlocado = transacoesCaixinhas
      .filter((t) => {
        if (!t.origem_mes_referencia || t.tipo !== 'deposito') return false
        const origem = t.origem_mes_referencia.toString()
        return origem.startsWith(mesRef)
      })
      .reduce((sum, t) => sum + t.valor, 0)

    const saldoDisponivel = saldoBruto - totalAlocado

    // Apenas incluir meses com saldo positivo disponível
    if (saldoDisponivel > 0) {
      mesesComSaldo.push({
        mesRef,
        saldoBruto,
        totalAlocado,
        saldoDisponivel,
      })
    }

    // Avançar para o próximo mês
    mesAtual = addMonths(mesAtual, 1)
  }

  const totalDisponivel = mesesComSaldo.reduce(
    (sum, m) => sum + m.saldoDisponivel,
    0
  )

  return { totalDisponivel, mesesComSaldo }
}
