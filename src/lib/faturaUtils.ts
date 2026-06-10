import { addDays, addMonths, format, parseISO, startOfDay, startOfMonth } from 'date-fns'

/**
 * Fonte única da lógica de ciclo de fatura de cartão de crédito.
 *
 * Regras:
 * - Compra DEPOIS do dia de fechamento entra no ciclo seguinte; compra NO dia
 *   do fechamento ainda entra no ciclo atual (`dia > dia_fechamento`).
 * - O "mês da fatura" (chave de agrupamento em todas as telas) é o mês do
 *   VENCIMENTO — o mesmo mês de `data_vencimento_fatura`, campo persistido
 *   nos lançamentos.
 * - Cartões em que o vencimento é no mesmo dia ou ANTES do fechamento
 *   (ex.: fecha dia 25, vence dia 5) vencem no mês SEGUINTE ao fechamento.
 *   Sem isso, uma compra de 10/jan ganharia vencimento 05/jan — no passado.
 */

export interface CicloCartao {
  dia_fechamento: number
  dia_vencimento: number
}

function toDate(data: string | Date): Date {
  return typeof data === 'string' ? parseISO(data) : data
}

/**
 * Mês (start of month) em que o ciclo da compra FECHA.
 * Compra no dia do fechamento ainda pertence ao ciclo atual.
 */
export function calcularMesFechamento(dataCompra: string | Date, diaFechamento: number): Date {
  const data = toDate(dataCompra)
  return data.getDate() > diaFechamento ? addMonths(startOfMonth(data), 1) : startOfMonth(data)
}

/**
 * Mês da fatura (chave de agrupamento) = mês do vencimento.
 */
export function calcularMesFatura(dataCompra: string | Date, cartao: CicloCartao): Date {
  const mesFechamento = calcularMesFechamento(dataCompra, cartao.dia_fechamento)
  return cartao.dia_vencimento <= cartao.dia_fechamento
    ? addMonths(mesFechamento, 1)
    : mesFechamento
}

/**
 * Data de vencimento da fatura de uma compra (valor persistido em
 * `lancamentos.data_vencimento_fatura`), no formato yyyy-MM-dd.
 */
export function calcularDataVencimentoFatura(dataCompra: string | Date, cartao: CicloCartao): string {
  const mesFatura = calcularMesFatura(dataCompra, cartao)
  const dataVencimento = new Date(mesFatura.getFullYear(), mesFatura.getMonth(), cartao.dia_vencimento)
  return format(dataVencimento, 'yyyy-MM-dd')
}

/**
 * Data de FECHAMENTO do ciclo de uma fatura (identificada pelo mês do
 * vencimento). Para cartões com vencimento <= fechamento, o ciclo fecha no
 * mês anterior ao do vencimento.
 */
export function getDataFechamentoFatura(mesFatura: Date, cartao: CicloCartao): Date {
  const mesFechamento = cartao.dia_vencimento <= cartao.dia_fechamento
    ? addMonths(startOfMonth(mesFatura), -1)
    : startOfMonth(mesFatura)
  return new Date(mesFechamento.getFullYear(), mesFechamento.getMonth(), cartao.dia_fechamento)
}

/**
 * Uma fatura só conta como fechada DEPOIS que o dia do fechamento termina —
 * no próprio dia ela ainda recebe compras (mesmo critério da associação).
 */
export function isFaturaFechada(mesFatura: Date, cartao: CicloCartao, hoje: Date = new Date()): boolean {
  return startOfDay(hoje).getTime() > getDataFechamentoFatura(mesFatura, cartao).getTime()
}

/**
 * Mês da fatura ATUAL (ciclo em aberto) do cartão.
 */
export function calcularFaturaAtual(cartao: CicloCartao, hoje: Date = new Date()): Date {
  return calcularMesFatura(hoje, cartao)
}

/**
 * Mês da fatura de um lançamento: prioriza o campo persistido
 * `data_vencimento_fatura`; recalcula pela data da compra como fallback
 * (lançamentos antigos de crédito podem não ter o campo).
 */
export function getMesFaturaLancamento(
  lancamento: { data: string; data_vencimento_fatura?: string | null },
  cartao: CicloCartao
): Date {
  return lancamento.data_vencimento_fatura
    ? startOfMonth(parseISO(lancamento.data_vencimento_fatura))
    : calcularMesFatura(lancamento.data, cartao)
}

/**
 * Período de compras coberto por uma fatura (dia seguinte ao fechamento
 * anterior até o dia do fechamento).
 */
export function getPeriodoCiclo(mesFatura: Date, cartao: CicloCartao): { inicio: Date; fim: Date } {
  const fim = getDataFechamentoFatura(mesFatura, cartao)
  const inicio = addDays(addMonths(fim, -1), 1)
  return { inicio, fim }
}
