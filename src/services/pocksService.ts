// @ts-nocheck
/**
 * Pocks Service — Motor de cálculo do Score de Saúde Financeira
 *
 * CRITÉRIOS (100 pontos base):
 *   1. Orçamento Geral          — 35 pts
 *   2. Planejamento Antecipado  — 20 pts
 *   3. Pontualidade             — 15 pts
 *   4. Consistência             — 10 pts
 *   5. Rebalanceamentos         — 10 pts
 *   6. Cobertura de Envelopes   — 10 pts
 *
 * BÔNUS: streak + melhoria contínua
 */

import { supabase } from '../lib/supabase'
import { formatCurrency } from '../utils/currency'

// ============================================================
// TYPES
// ============================================================

export interface CriterioScore {
  score: number
  max: number
  detail: string
}

export interface CriteriaBreakdown {
  budget_adherence: CriterioScore
  early_planning: CriterioScore
  entry_timeliness: CriterioScore
  entry_consistency: CriterioScore
  smart_rebalancing: CriterioScore
  envelope_coverage: CriterioScore
}

export interface Bonus {
  type: 'streak' | 'improvement'
  value: number
  description: string
}

export interface PocksMonthResult {
  mes_referencia: string        // 'YYYY-MM-01'
  total_score: number
  criteria_breakdown: CriteriaBreakdown
  bonuses: Bonus[]
  calculated_at: string
  had_orcamento: boolean
}

export interface PocksData {
  mesAtual: PocksMonthResult
  historico: PocksMonthResult[] // últimos 5 meses anteriores (cronológico, mais antigo primeiro)
  scoreGeral: number
  tendencia: 'alta' | 'estavel' | 'queda'
  streakAtual: number
  melhorStreak: number
}

// ============================================================
// HELPERS
// ============================================================

function getMesRange(mes: Date): { firstDay: string; nextFirstDay: string } {
  const y = mes.getFullYear()
  const m = mes.getMonth()
  const firstDay = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const next = new Date(y, m + 1, 1)
  const nextFirstDay = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-01`
  return { firstDay, nextFirstDay }
}

function mesFromString(s: string): Date {
  const [y, m] = s.split('-').map(Number)
  return new Date(y, m - 1, 1)
}

const ZERO_RESULT = (firstDay: string): PocksMonthResult => ({
  mes_referencia: firstDay,
  total_score: 0,
  criteria_breakdown: {
    budget_adherence:  { score: 0, max: 35, detail: 'Nenhum orçamento definido para este mês' },
    early_planning:    { score: 0, max: 20, detail: 'Nenhum orçamento definido' },
    entry_timeliness:  { score: 0, max: 15, detail: 'Sem dados' },
    entry_consistency: { score: 0, max: 10, detail: 'Sem dados' },
    smart_rebalancing: { score: 0, max: 10, detail: 'Sem dados' },
    envelope_coverage: { score: 0, max: 10, detail: 'Sem dados' },
  },
  bonuses: [],
  calculated_at: new Date().toISOString(),
  had_orcamento: false,
})

// ============================================================
// CRITÉRIO 1 — ORÇAMENTO GERAL (35 pts)
// ============================================================

function calcBudgetAdherence(
  categoriasBudget: any[],
  totalGasto: number
): CriterioScore {
  const totalOrcado = categoriasBudget
    .filter((cb: any) => cb.categoria?.tipo === 'despesa')
    .reduce((sum: number, cb: any) => sum + (cb.valor_orcado || 0), 0)

  if (totalOrcado === 0) {
    return { score: 0, max: 35, detail: 'Nenhuma categoria de despesa orçada' }
  }

  const folga = totalOrcado - totalGasto
  const percentAcima = ((totalGasto - totalOrcado) / totalOrcado) * 100

  if (totalGasto <= totalOrcado) {
    return { score: 35, max: 35, detail: `Dentro do orçamento! (${formatCurrency(folga)} de folga)` }
  } else if (percentAcima <= 5) {
    return { score: 25, max: 35, detail: `${percentAcima.toFixed(1)}% acima do orçamento (${formatCurrency(Math.abs(folga))} a mais)` }
  } else if (percentAcima <= 10) {
    return { score: 15, max: 35, detail: `${percentAcima.toFixed(1)}% acima do orçamento (${formatCurrency(Math.abs(folga))} a mais)` }
  } else if (percentAcima <= 20) {
    return { score: 8, max: 35, detail: `${percentAcima.toFixed(1)}% acima do orçamento (${formatCurrency(Math.abs(folga))} a mais)` }
  } else {
    return { score: 0, max: 35, detail: `${percentAcima.toFixed(1)}% acima do orçamento — muito acima do planejado` }
  }
}

// ============================================================
// CRITÉRIO 2 — PLANEJAMENTO ANTECIPADO (20 pts)
// ============================================================

function calcEarlyPlanning(orcamentoCreatedAt: string, firstDay: string): CriterioScore {
  const createdDate = new Date(orcamentoCreatedAt)
  const mesStart = new Date(firstDay)
  // diff em dias: positivo = criado depois do início do mês
  const diffMs = createdDate.getTime() - mesStart.getTime()
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const dateStr = createdDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  if (diffDias < 0) {
    return { score: 20, max: 20, detail: `Orçamento criado em ${dateStr}, antes do início do mês — perfeito!` }
  } else if (diffDias <= 2) {
    return { score: 14, max: 20, detail: `Orçamento criado no dia ${diffDias + 1}º do mês (${dateStr})` }
  } else if (diffDias <= 6) {
    return { score: 8, max: 20, detail: `Orçamento criado no dia ${diffDias + 1}º do mês (${dateStr})` }
  } else {
    return { score: 3, max: 20, detail: `Orçamento criado somente no dia ${diffDias + 1}º do mês (${dateStr}) — planeje antes!` }
  }
}

// ============================================================
// CRITÉRIO 3 — PONTUALIDADE (15 pts)
// ============================================================

function calcEntryTimeliness(lancamentos: any[]): CriterioScore {
  if (lancamentos.length === 0) {
    return { score: 15, max: 15, detail: 'Sem lançamentos para avaliar' }
  }

  const diffs = lancamentos.map((l: any) => {
    const dataGasto = new Date(l.data)
    // Compara apenas a parte da data do created_at
    const dataLancamento = new Date(l.created_at.split('T')[0])
    const diff = Math.floor(
      (dataLancamento.getTime() - dataGasto.getTime()) / (1000 * 60 * 60 * 24)
    )
    return Math.max(0, diff)
  })

  const media = diffs.reduce((a: number, b: number) => a + b, 0) / diffs.length

  if (media <= 1) {
    return { score: 15, max: 15, detail: `Média de ${media.toFixed(1)} dia de atraso nos lançamentos — excelente!` }
  } else if (media <= 2) {
    return { score: 12, max: 15, detail: `Média de ${media.toFixed(1)} dias de atraso nos lançamentos — muito bom!` }
  } else if (media <= 3) {
    return { score: 9, max: 15, detail: `Média de ${media.toFixed(1)} dias de atraso nos lançamentos` }
  } else if (media <= 5) {
    return { score: 5, max: 15, detail: `Média de ${media.toFixed(1)} dias de atraso — tente lançar mais cedo` }
  } else {
    return { score: 2, max: 15, detail: `Média de ${media.toFixed(1)} dias de atraso — lance os gastos no dia em que ocorrem` }
  }
}

// ============================================================
// CRITÉRIO 4 — CONSISTÊNCIA (10 pts)
// ============================================================

function calcEntryConsistency(lancamentos: any[]): CriterioScore {
  // Conta em quantos dias distintos o usuário fez lançamentos (pela data de criação)
  const dias = new Set(lancamentos.map((l: any) => l.created_at.split('T')[0]))
  const numDias = dias.size

  if (numDias >= 25) {
    return { score: 10, max: 10, detail: `Lançamentos em ${numDias} dias do mês — uso exemplar!` }
  } else if (numDias >= 20) {
    return { score: 8, max: 10, detail: `Lançamentos em ${numDias} dias do mês — muito bom!` }
  } else if (numDias >= 15) {
    return { score: 6, max: 10, detail: `Lançamentos em ${numDias} dias do mês` }
  } else if (numDias >= 10) {
    return { score: 4, max: 10, detail: `Lançamentos em ${numDias} dias do mês — use o app com mais frequência` }
  } else if (numDias >= 5) {
    return { score: 2, max: 10, detail: `Lançamentos em apenas ${numDias} dias do mês` }
  } else {
    if (numDias === 0) {
      return { score: 0, max: 10, detail: 'Nenhum lançamento registrado neste mês' }
    }
    return { score: 0, max: 10, detail: `Lançamentos em apenas ${numDias} dia(s) — lançamentos em lote detectados` }
  }
}

// ============================================================
// CRITÉRIO 5 — REBALANCEAMENTOS (10 pts)
// ============================================================

function calcSmartRebalancing(numRebal: number): CriterioScore {
  if (numRebal === 0) {
    return { score: 6, max: 10, detail: 'Nenhum rebalanceamento — bom planejamento inicial' }
  } else if (numRebal <= 3) {
    return { score: 10, max: 10, detail: `${numRebal} rebalanceamento(s) — uso ideal, mostra atenção ao orçamento!` }
  } else if (numRebal <= 5) {
    return { score: 7, max: 10, detail: `${numRebal} rebalanceamentos — aceitável, mas considere planejar melhor` }
  } else if (numRebal <= 8) {
    return { score: 4, max: 10, detail: `${numRebal} rebalanceamentos — muitos ajustes, revise o planejamento inicial` }
  } else {
    return { score: 2, max: 10, detail: `${numRebal} rebalanceamentos — muitos ajustes indicam planejamento fraco` }
  }
}

// ============================================================
// CRITÉRIO 6 — COBERTURA DE ENVELOPES (10 pts)
// ============================================================

function calcEnvelopeCoverage(lancamentos: any[], categoriasBudget: any[]): CriterioScore {
  if (lancamentos.length === 0) {
    return { score: 10, max: 10, detail: 'Sem despesas para avaliar' }
  }

  const idsNoOrcamento = new Set(categoriasBudget.map((cb: any) => cb.categoria_id))
  const cobertas = lancamentos.filter(
    (l: any) => l.categoria_id && idsNoOrcamento.has(l.categoria_id)
  ).length
  const pct = (cobertas / lancamentos.length) * 100

  if (pct >= 100) {
    return { score: 10, max: 10, detail: '100% das despesas em envelopes — perfeito!' }
  } else if (pct >= 95) {
    return { score: 8, max: 10, detail: `${pct.toFixed(0)}% das despesas em envelopes` }
  } else if (pct >= 85) {
    return { score: 6, max: 10, detail: `${pct.toFixed(0)}% das despesas em envelopes — categorize mais` }
  } else if (pct >= 70) {
    return { score: 4, max: 10, detail: `${pct.toFixed(0)}% das despesas em envelopes — muitas sem categoria` }
  } else {
    return { score: 1, max: 10, detail: `Apenas ${pct.toFixed(0)}% em envelopes — categorize todas suas despesas!` }
  }
}

// ============================================================
// CÁLCULO BASE DE UM MÊS (sem bônus)
// ============================================================

async function calcularScoreBase(
  familyId: string,
  mes: Date
): Promise<PocksMonthResult | null> {
  if (!supabase) return null

  const { firstDay, nextFirstDay } = getMesRange(mes)

  // Busca em paralelo: orçamento + lançamentos
  const [orcRes, lancRes] = await Promise.all([
    (supabase as any)
      .from('orcamentos_mensais')
      .select(`
        id,
        created_at,
        categorias_budget(
          valor_orcado,
          categoria_id,
          categoria:categorias(tipo)
        )
      `)
      .eq('family_id', familyId)
      .eq('mes_referencia', firstDay)
      .maybeSingle(),

    (supabase as any)
      .from('lancamentos')
      .select('id, valor, data, created_at, categoria_id')
      .eq('family_id', familyId)
      .eq('tipo', 'despesa')
      .eq('status', 'pago')
      .gte('data', firstDay)
      .lt('data', nextFirstDay),
  ])

  const orcamento = orcRes.data
  const lancamentos: any[] = lancRes.data || []

  if (!orcamento) return { ...ZERO_RESULT(firstDay) }

  // Busca rebalanceamentos do orçamento
  const rebalRes = await (supabase as any)
    .from('historico_rebalanceamentos')
    .select('id')
    .eq('family_id', familyId)
    .eq('orcamento_id', orcamento.id)

  const numRebal = rebalRes.data?.length || 0
  const categoriasBudget: any[] = orcamento.categorias_budget || []
  const totalGasto = lancamentos.reduce((s: number, l: any) => s + (l.valor || 0), 0)

  const criteria_breakdown: CriteriaBreakdown = {
    budget_adherence:  calcBudgetAdherence(categoriasBudget, totalGasto),
    early_planning:    calcEarlyPlanning(orcamento.created_at, firstDay),
    entry_timeliness:  calcEntryTimeliness(lancamentos),
    entry_consistency: calcEntryConsistency(lancamentos),
    smart_rebalancing: calcSmartRebalancing(numRebal),
    envelope_coverage: calcEnvelopeCoverage(lancamentos, categoriasBudget),
  }

  const baseScore = Object.values(criteria_breakdown).reduce((s, c) => s + c.score, 0)

  return {
    mes_referencia: firstDay,
    total_score: baseScore,
    criteria_breakdown,
    bonuses: [],
    calculated_at: new Date().toISOString(),
    had_orcamento: true,
  }
}

// ============================================================
// BUSCAR SCORE DE UM MÊS PASSADO (cache → recalcular)
// ============================================================

async function getScoreMesCached(
  familyId: string,
  mes: Date
): Promise<PocksMonthResult | null> {
  if (!supabase) return null

  const { firstDay } = getMesRange(mes)

  // Tenta buscar do cache
  const { data: cached } = await (supabase as any)
    .from('pocks_monthly_scores')
    .select('total_score, criteria_breakdown, bonuses, calculated_at')
    .eq('family_id', familyId)
    .eq('month', firstDay)
    .maybeSingle()

  if (cached) {
    return {
      mes_referencia: firstDay,
      total_score: cached.total_score,
      criteria_breakdown: cached.criteria_breakdown as CriteriaBreakdown,
      bonuses: cached.bonuses as Bonus[],
      calculated_at: cached.calculated_at,
      had_orcamento: true,
    }
  }

  // Não está no cache: calcula e salva
  const result = await calcularScoreBase(familyId, mes)
  if (result?.had_orcamento) {
    await salvarScore(familyId, result)
  }
  return result
}

// ============================================================
// STREAK — meses consecutivos dentro do orçamento
// ============================================================

function calcularStreak(scores: PocksMonthResult[]): { current: number; best: number } {
  // Conta meses consecutivos (mais recente primeiro) com budget_adherence.score > 0
  let current = 0
  let best = 0
  let streak = 0

  for (let i = scores.length - 1; i >= 0; i--) {
    const s = scores[i]
    if (!s.had_orcamento) break
    if (s.criteria_breakdown.budget_adherence.score > 0) {
      streak++
      if (i === scores.length - 1) current = streak // só conta streak ativa
    } else {
      break
    }
  }

  // Best streak: varre todos
  let tempStreak = 0
  for (const s of scores) {
    if (s.had_orcamento && s.criteria_breakdown.budget_adherence.score > 0) {
      tempStreak++
      best = Math.max(best, tempStreak)
    } else {
      tempStreak = 0
    }
  }

  return { current, best }
}

// ============================================================
// SALVAR SCORE NO CACHE
// ============================================================

async function salvarScore(familyId: string, result: PocksMonthResult): Promise<void> {
  if (!supabase || !result.had_orcamento) return

  await (supabase as any)
    .from('pocks_monthly_scores')
    .upsert(
      {
        family_id: familyId,
        month: result.mes_referencia,
        total_score: result.total_score,
        criteria_breakdown: result.criteria_breakdown,
        bonuses: result.bonuses,
        calculated_at: result.calculated_at,
      },
      { onConflict: 'family_id,month' }
    )
}

// ============================================================
// FUNÇÃO PRINCIPAL — carrega todos os dados para o dashboard
// ============================================================

export async function carregarDadosPocks(familyId: string): Promise<PocksData | null> {
  if (!supabase || !familyId) return null

  const hoje = new Date()

  // Gera os últimos 6 meses (inclusive mês atual, do mais antigo para o mais recente)
  const meses: Date[] = []
  for (let i = 5; i >= 0; i--) {
    meses.push(new Date(hoje.getFullYear(), hoje.getMonth() - i, 1))
  }

  const mesAtualDate = meses[meses.length - 1]
  const mesesPassados = meses.slice(0, 5)

  // Mês atual: sempre recalcula em tempo real
  const mesAtualBase = await calcularScoreBase(familyId, mesAtualDate)
  if (!mesAtualBase) return null

  // Meses passados: cache com fallback para recálculo
  const historicoBase = (
    await Promise.all(mesesPassados.map((m) => getScoreMesCached(familyId, m)))
  ).filter(Boolean) as PocksMonthResult[]

  // Todos os scores em ordem cronológica para calcular streak
  const todosScores = [...historicoBase, mesAtualBase]
  const { current: streakAtual, best: melhorStreak } = calcularStreak(todosScores)

  // Bônus do mês atual
  const bonuses: Bonus[] = []

  if (streakAtual >= 2) {
    const streakBonus =
      streakAtual >= 6 ? 12 :
      streakAtual >= 5 ? 10 :
      streakAtual >= 4 ? 8  :
      streakAtual >= 3 ? 5  : 3
    bonuses.push({
      type: 'streak',
      value: streakBonus,
      description: `${streakAtual} meses consecutivos dentro do orçamento`,
    })
  }

  const mesAnterior = historicoBase[historicoBase.length - 1]
  if (mesAnterior && mesAtualBase.total_score > mesAnterior.total_score) {
    bonuses.push({
      type: 'improvement',
      value: 2,
      description: 'Score melhorou em relação ao mês anterior',
    })
  }

  const totalBonuses = bonuses.reduce((s, b) => s + b.value, 0)
  const mesAtual: PocksMonthResult = {
    ...mesAtualBase,
    total_score: mesAtualBase.total_score + totalBonuses,
    bonuses,
  }

  // Salva mês atual no cache
  await salvarScore(familyId, mesAtual)

  // Score geral: média ponderada (mais recentes pesam mais)
  const allScores = [...historicoBase, mesAtual]
  const pesos = [0.5, 1, 1.5, 2, 2.5, 3] // índice 0 = mais antigo, 5 = atual
  let weightedSum = 0
  let totalWeight = 0
  allScores.forEach((s, i) => {
    const w = pesos[i] ?? 0.5
    weightedSum += s.total_score * w
    totalWeight += w
  })
  const scoreGeral = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  // Tendência
  let tendencia: 'alta' | 'estavel' | 'queda' = 'estavel'
  if (allScores.length >= 4) {
    const recente = (allScores[allScores.length - 1].total_score + allScores[allScores.length - 2].total_score) / 2
    const anterior = (allScores[allScores.length - 3].total_score + allScores[allScores.length - 4].total_score) / 2
    if (recente - anterior > 5) tendencia = 'alta'
    else if (anterior - recente > 5) tendencia = 'queda'
  }

  return {
    mesAtual,
    historico: historicoBase,
    scoreGeral,
    tendencia,
    streakAtual,
    melhorStreak,
  }
}

// ============================================================
// HELPERS EXPORTADOS PARA A UI
// ============================================================

export function getScoreColor(score: number): string {
  if (score >= 81) return 'text-secondary-400'
  if (score >= 61) return 'text-primary-400'
  if (score >= 41) return 'text-yellow-400'
  return 'text-red-400'
}

export function getScoreLabel(score: number): string {
  if (score >= 81) return 'Excelente'
  if (score >= 61) return 'Bom'
  if (score >= 41) return 'Atenção'
  return 'Crítico'
}

export function getScoreBgColor(score: number): string {
  if (score >= 81) return 'bg-secondary-500'
  if (score >= 61) return 'bg-primary-500'
  if (score >= 41) return 'bg-yellow-500'
  return 'bg-red-500'
}

export function getBarColor(score: number): string {
  if (score >= 81) return '#a855f7'  // secondary
  if (score >= 61) return '#0ea5e9'  // primary
  if (score >= 41) return '#eab308'  // yellow
  return '#ef4444'                    // red
}

export function getMesLabel(mesReferencia: string): string {
  const [y, m] = mesReferencia.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
}

export function getMesLabelLong(mesReferencia: string): string {
  const [y, m] = mesReferencia.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}
