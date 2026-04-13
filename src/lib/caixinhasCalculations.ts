/**
 * caixinhasCalculations.ts
 * Funções de cálculo para caixinhas de Objetivos & Reservas (Metas e Sonhos)
 *
 * REGRAS:
 * - Todos os cálculos rodam no frontend (sem chamadas desnecessárias ao banco)
 * - Não afeta caixinhas de tipo='investimento'
 */

import { differenceInMonths, addMonths, format, parseISO, startOfMonth } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { CaixinhaComDetalhes, CaixinhaHistoricoMensal } from '../types'

// =====================================================
// 1. APORTE SUGERIDO
// =====================================================

/**
 * Calcula o aporte mensal sugerido para atingir a meta no prazo.
 *
 * aporte_sugerido = (meta_valor - saldo_conquistado) / meses_restantes_efetivos
 *
 * meses_restantes_efetivos: meses corridos até prazo_data,
 * excluindo os meses já pausados (que estendem o prazo).
 *
 * @returns null se meta ou prazo não estiverem definidos, ou se meta já atingida
 */
export function calcularAporteSugerido(
  metaValor: number | null,
  saldoConquistado: number,
  prazoData: string | null,
  mesesPausados: number = 0
): number | null {
  if (!metaValor || !prazoData) return null
  if (saldoConquistado >= metaValor) return 0

  const hoje = startOfMonth(new Date())
  const prazo = startOfMonth(parseISO(prazoData))
  const mesesCorridos = differenceInMonths(prazo, hoje)

  // Meses efetivos = meses corridos + meses pausados (extensão automática)
  const mesesEfetivos = mesesCorridos + mesesPausados

  if (mesesEfetivos <= 0) return metaValor - saldoConquistado // já atrasado

  const valorFaltante = metaValor - saldoConquistado
  return Math.ceil((valorFaltante / mesesEfetivos) * 100) / 100
}

// =====================================================
// 2. PROJEÇÃO DE CONCLUSÃO
// =====================================================

/**
 * Projeta quando a meta será atingida com base na média de depósitos dos
 * últimos N meses do histórico.
 *
 * @param metaValor - Valor da meta
 * @param saldoConquistado - Saldo conquistado atual
 * @param historico - Array de histórico mensal (qualquer tamanho)
 * @param mesesParaMedia - Quantos meses considerar para a média (padrão: 3)
 * @returns Data projetada ou null se média for zero/histórico insuficiente
 */
export function calcularProjecaoConclusao(
  metaValor: number | null,
  saldoConquistado: number,
  historico: CaixinhaHistoricoMensal[],
  mesesParaMedia: number = 3
): Date | null {
  if (!metaValor || saldoConquistado >= metaValor) return null

  // Ordenar do mais recente para o mais antigo
  const historicoOrdenado = [...historico].sort(
    (a, b) => new Date(b.mes_referencia).getTime() - new Date(a.mes_referencia).getTime()
  )

  // Pegar os últimos N meses NÃO pausados para a média
  const mesesAtivos = historicoOrdenado
    .filter((h) => !h.mes_pausado)
    .slice(0, mesesParaMedia)

  if (mesesAtivos.length === 0) return null

  const mediaDepositos =
    mesesAtivos.reduce((sum, h) => sum + h.valor_depositado, 0) / mesesAtivos.length

  if (mediaDepositos <= 0) return null

  const valorFaltante = metaValor - saldoConquistado
  const mesesRestantes = Math.ceil(valorFaltante / mediaDepositos)

  return addMonths(startOfMonth(new Date()), mesesRestantes)
}

/**
 * Formata a projeção de conclusão como string legível.
 * Ex: "ago/2025" ou null
 */
export function formatarProjecaoConclusao(
  metaValor: number | null,
  saldoConquistado: number,
  historico: CaixinhaHistoricoMensal[]
): string | null {
  const data = calcularProjecaoConclusao(metaValor, saldoConquistado, historico)
  if (!data) return null
  return format(data, "MMM/yyyy", { locale: ptBR })
}

// =====================================================
// 3. BADGE DE STATUS
// =====================================================

export type BadgeStatus = 'no_prazo' | 'atencao' | 'em_risco' | 'pausada' | 'concluida' | 'sem_prazo'

/**
 * Calcula o badge de status da caixinha comparando o ritmo atual com o aporte sugerido.
 */
export function calcularBadgeStatus(
  caixinha: Pick<CaixinhaComDetalhes, 'status' | 'meta_valor' | 'prazo_data' | 'saldo_conquistado' | 'meses_pausados'>,
  historico: CaixinhaHistoricoMensal[]
): BadgeStatus {
  if (caixinha.status === 'concluida') return 'concluida'
  if (caixinha.status === 'pausada') return 'pausada'
  if (!caixinha.meta_valor || !caixinha.prazo_data) return 'sem_prazo'

  if ((caixinha.saldo_conquistado ?? 0) >= caixinha.meta_valor) return 'no_prazo'

  const aporteSugerido = calcularAporteSugerido(
    caixinha.meta_valor,
    caixinha.saldo_conquistado ?? 0,
    caixinha.prazo_data,
    caixinha.meses_pausados ?? 0
  )

  if (!aporteSugerido || aporteSugerido <= 0) return 'no_prazo'

  // Média dos últimos 3 meses não pausados
  const historicoOrdenado = [...historico]
    .filter((h) => !h.mes_pausado)
    .sort((a, b) => new Date(b.mes_referencia).getTime() - new Date(a.mes_referencia).getTime())
    .slice(0, 3)

  if (historicoOrdenado.length === 0) return 'sem_prazo'

  const media3m =
    historicoOrdenado.reduce((sum, h) => sum + h.valor_depositado, 0) / historicoOrdenado.length

  if (media3m >= aporteSugerido * 0.9) return 'no_prazo'
  if (media3m >= aporteSugerido * 0.5) return 'atencao'
  return 'em_risco'
}

// =====================================================
// 4. AGRUPAMENTO POR HORIZONTE
// =====================================================

export type HorizonteGroup = 'curto' | 'medio' | 'longo' | 'sem_prazo'

export interface CaixinhasPorHorizonte {
  curto: CaixinhaComDetalhes[]   // até 12 meses
  medio: CaixinhaComDetalhes[]   // 13 a 36 meses
  longo: CaixinhaComDetalhes[]   // acima de 36 meses
  sem_prazo: CaixinhaComDetalhes[] // sem prazo_data
}

/**
 * Agrupa caixinhas por horizonte temporal baseado em prazo_data.
 * Dentro de cada grupo, ordena por ordem_exibicao (ASC, nulls last), depois created_at.
 */
export function agruparPorHorizonte(
  caixinhas: CaixinhaComDetalhes[]
): CaixinhasPorHorizonte {
  const hoje = startOfMonth(new Date())

  const resultado: CaixinhasPorHorizonte = {
    curto: [],
    medio: [],
    longo: [],
    sem_prazo: [],
  }

  for (const c of caixinhas) {
    if (!c.prazo_data) {
      resultado.sem_prazo.push(c)
      continue
    }
    const meses = differenceInMonths(parseISO(c.prazo_data), hoje)
    if (meses <= 12) {
      resultado.curto.push(c)
    } else if (meses <= 36) {
      resultado.medio.push(c)
    } else {
      resultado.longo.push(c)
    }
  }

  // Ordenar cada grupo
  const comparar = (a: CaixinhaComDetalhes, b: CaixinhaComDetalhes) => {
    const ordemA = a.ordem_exibicao ?? Infinity
    const ordemB = b.ordem_exibicao ?? Infinity
    if (ordemA !== ordemB) return ordemA - ordemB
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  }

  resultado.curto.sort(comparar)
  resultado.medio.sort(comparar)
  resultado.longo.sort(comparar)
  resultado.sem_prazo.sort(comparar)

  return resultado
}

// =====================================================
// 5. STREAK
// =====================================================

/**
 * Calcula a sequência atual de meses contribuídos.
 * Meses pausados não quebram o streak e não contam como contribuição.
 *
 * @param historico - Array com histórico de todos os meses registrados
 * @returns Número de meses consecutivos com depósito (ignorando pausados)
 */
export function calcularStreak(historico: CaixinhaHistoricoMensal[]): number {
  if (historico.length === 0) return 0

  // Ordenar do mais recente para o mais antigo
  const ordenado = [...historico].sort(
    (a, b) => new Date(b.mes_referencia).getTime() - new Date(a.mes_referencia).getTime()
  )

  let streak = 0
  for (const mes of ordenado) {
    if (mes.mes_pausado) continue // Mês pausado: ignora na contagem mas não quebra
    if (mes.houve_deposito) {
      streak++
    } else {
      break // Mês sem depósito (não pausado) quebra o streak
    }
  }

  return streak
}

/**
 * Retorna os últimos N meses para a mini-timeline, do mais antigo ao mais recente.
 */
export function getUltimosMeses(
  historico: CaixinhaHistoricoMensal[],
  quantidade: number = 6
): CaixinhaHistoricoMensal[] {
  return [...historico]
    .sort((a, b) => new Date(a.mes_referencia).getTime() - new Date(b.mes_referencia).getTime())
    .slice(-quantidade)
}
