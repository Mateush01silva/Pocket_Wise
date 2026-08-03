import { format, parseISO } from 'date-fns'
import type { Lancamento, TransactionType } from '../types'
import { formatCurrency } from '../utils/currency'

/**
 * Detecção de possíveis lançamentos duplicados no momento do cadastro.
 *
 * Critério: mesmo tipo + mesma data + mesmo valor + mesma categoria
 * principal. A subcategoria fica propositalmente de fora — exigi-la
 * restringiria demais e deixaria passar duplicatas reais lançadas sem
 * subcategoria (ou com subcategoria diferente).
 */

export interface CandidatoLancamento {
  tipo: TransactionType
  data: string // YYYY-MM-DD
  valor: number
  categoria_id: string
}

export function encontrarLancamentosParecidos(
  lancamentos: Lancamento[],
  candidato: CandidatoLancamento
): Lancamento[] {
  // Comparação em centavos evita falso-negativo por ruído de ponto flutuante
  const valorCentavos = Math.round(candidato.valor * 100)
  return lancamentos.filter(
    (l) =>
      l.tipo === candidato.tipo &&
      l.data === candidato.data &&
      l.categoria_id === candidato.categoria_id &&
      Math.round(l.valor * 100) === valorCentavos
  )
}

const FORMA_PAGAMENTO_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  pix: 'PIX',
  transferencia: 'Transferência',
  boleto: 'Boleto',
}

export function descreverLancamento(l: Lancamento): string {
  const partes = [
    format(parseISO(l.data), 'dd/MM/yyyy'),
    formatCurrency(l.valor),
    FORMA_PAGAMENTO_LABELS[l.forma_pagamento] || l.forma_pagamento,
  ]
  if (l.parcela_atual && l.parcela_total && l.parcela_total > 1) {
    partes.push(`parcela ${l.parcela_atual}/${l.parcela_total}`)
  }
  if (l.observacao) {
    partes.push(`"${l.observacao}"`)
  }
  return partes.join(' · ')
}

const MAX_LISTADOS = 3

export function montarMensagemDuplicados(duplicados: Lancamento[]): string {
  const cabecalho =
    duplicados.length === 1
      ? 'Já existe um lançamento com a mesma data, valor e categoria:'
      : `Já existem ${duplicados.length} lançamentos com a mesma data, valor e categoria:`

  const linhas = [
    cabecalho,
    '',
    ...duplicados.slice(0, MAX_LISTADOS).map((l) => `• ${descreverLancamento(l)}`),
  ]
  if (duplicados.length > MAX_LISTADOS) {
    linhas.push(`…e mais ${duplicados.length - MAX_LISTADOS}`)
  }
  linhas.push('', 'Deseja lançar mesmo assim?')
  return linhas.join('\n')
}
