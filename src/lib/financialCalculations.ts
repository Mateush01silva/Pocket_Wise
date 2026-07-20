import type { Lancamento, TransacaoCaixinha } from '../types'
import { startOfMonth, endOfMonth, subMonths, format, isBefore, addMonths } from 'date-fns'
import { parseLocalDate } from '../utils/date'

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
    const dataLancamento = parseLocalDate(l.data)
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
 *
 * Semântica de FLUXO DE CAIXA: lançamentos de cartão entram no mês de
 * data_vencimento_fatura (quando o dinheiro efetivamente sai), diferente do
 * envelope (getMesEnvelope em budgetCalculations.ts), que usa o mês em que o
 * gasto foi comprometido. A diferença é intencional — não "unificar".
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
      const dataLancamento = parseLocalDate(l.data_vencimento_fatura || l.data)
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
      const dataLancamento = parseLocalDate(l.data_vencimento_fatura || l.data)
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
    const dataLancamento = parseLocalDate(l.data_vencimento_fatura || l.data)
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
  saldoBruto: number // Receitas regulares - Despesas do mês (sem caixinhas)
  totalRetiradasCaixinhas: number // Retiradas de caixinhas destinadas a este mês
  totalAlocado: number // Total já depositado em caixinhas a partir deste mês
  saldoDisponivel: number // saldoBruto + totalRetiradasCaixinhas - totalAlocado
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
    .map((l) => parseLocalDate(l.data))
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

    // Retiradas de caixinhas destinadas a compor o orçamento deste mês
    // (dinheiro que o usuário sacou da caixinha para usar neste mês)
    const totalRetiradasCaixinhas = transacoesCaixinhas
      .filter((t) => {
        if (t.tipo !== 'retirada' || !t.destino_mes_referencia) return false
        return t.destino_mes_referencia.toString().startsWith(mesRef)
      })
      .reduce((sum, t) => sum + t.valor, 0)

    // Calcular total já alocado deste mês em caixinhas
    // (saldo que o usuário decidiu guardar em caixinhas a partir deste mês)
    // A transação.origem_mes_referencia pode ser 'YYYY-MM-DD' ou 'YYYY-MM'
    const totalAlocado = transacoesCaixinhas
      .filter((t) => {
        if (!t.origem_mes_referencia || t.tipo !== 'deposito') return false
        const origem = t.origem_mes_referencia.toString()
        return origem.startsWith(mesRef)
      })
      .reduce((sum, t) => sum + t.valor, 0)

    // Saldo disponível = fluxo orgânico + retiradas de caixinha - já guardado novamente
    // Exemplo: receitas R$3.000, despesas R$3.348, caixinha R$500 → sobra R$152
    const saldoDisponivel = Math.round((saldoBruto + totalRetiradasCaixinhas - totalAlocado) * 100) / 100

    // Apenas incluir meses com saldo positivo disponível (> R$ 0,00)
    if (saldoDisponivel > 0) {
      mesesComSaldo.push({
        mesRef,
        saldoBruto: Math.round(saldoBruto * 100) / 100,
        totalRetiradasCaixinhas: Math.round(totalRetiradasCaixinhas * 100) / 100,
        totalAlocado: Math.round(totalAlocado * 100) / 100,
        saldoDisponivel,
      })
    }

    // Avançar para o próximo mês
    mesAtual = addMonths(mesAtual, 1)
  }

  const totalDisponivel = Math.round(
    mesesComSaldo.reduce((sum, m) => sum + m.saldoDisponivel, 0) * 100
  ) / 100

  return { totalDisponivel, mesesComSaldo }
}

/**
 * Interface para retiradas de caixinhas destinadas a um mês específico
 */
export interface RetiradaCaixinhaParaOrcamento {
  id: string
  caixinha_id: string
  caixinha_nome: string
  caixinha_icone: string | null
  valor: number
  descricao: string | null
}

/**
 * Obtém todas as retiradas de caixinhas que são destinadas a compor o orçamento de um mês específico
 * @param transacoesCaixinhas - Todas as transações de caixinhas
 * @param caixinhas - Lista de caixinhas para obter nomes e ícones
 * @param mesReferencia - Mês no formato YYYY-MM
 * @returns Lista de retiradas com detalhes da caixinha
 */
export function getRetiradasCaixinhasParaMes(
  transacoesCaixinhas: TransacaoCaixinha[],
  caixinhas: Array<{ id: string; nome: string; icone: string | null }>,
  mesReferencia: string
): {
  retiradas: RetiradaCaixinhaParaOrcamento[]
  totalRetiradas: number
} {
  // Filtrar retiradas que têm destino_mes_referencia correspondente ao mês
  const retiradasDoMes = transacoesCaixinhas.filter((t) => {
    if (t.tipo !== 'retirada' || !t.destino_mes_referencia) return false
    return t.destino_mes_referencia.startsWith(mesReferencia)
  })

  // Mapear para incluir detalhes da caixinha
  const retiradas: RetiradaCaixinhaParaOrcamento[] = retiradasDoMes.map((t) => {
    const caixinha = caixinhas.find((c) => c.id === t.caixinha_id)
    return {
      id: t.id,
      caixinha_id: t.caixinha_id,
      caixinha_nome: caixinha?.nome || 'Caixinha',
      caixinha_icone: caixinha?.icone || null,
      valor: t.valor,
      descricao: t.descricao,
    }
  })

  const totalRetiradas = retiradas.reduce((sum, r) => sum + r.valor, 0)

  return { retiradas, totalRetiradas }
}
