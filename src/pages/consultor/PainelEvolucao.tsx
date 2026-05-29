import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Minus, Trophy, Loader2, AlertCircle } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import {
  carregarDadosPocks,
  getScoreColor,
  getMesLabel,
  type PocksData,
  type CriteriaBreakdown,
} from '../../services/pocksService'
import { cn } from '../../lib/cn'

// ── Config ────────────────────────────────────────────────────

const CRITERIOS: { key: keyof CriteriaBreakdown; label: string; peso: string }[] = [
  { key: 'budget_adherence', label: 'Orçamento Geral', peso: '35%' },
  { key: 'early_planning', label: 'Planejamento Antecipado', peso: '20%' },
  { key: 'entry_timeliness', label: 'Pontualidade Lançamentos', peso: '15%' },
  { key: 'entry_consistency', label: 'Consistência Diária', peso: '10%' },
  { key: 'smart_rebalancing', label: 'Rebalanceamento', peso: '10%' },
  { key: 'envelope_coverage', label: 'Cobertura Envelopes', peso: '10%' },
]

// ── Helpers ──────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-emerald-400">
        <TrendingUp className="w-3 h-3" />+{delta}
      </span>
    )
  if (delta < 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-red-400">
        <TrendingDown className="w-3 h-3" />{delta}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-gray-500">
      <Minus className="w-3 h-3" />0
    </span>
  )
}

function ScoreBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value >= 80 ? 'bg-emerald-500' : value >= 60 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="h-1.5 rounded-full bg-dark-700/60 overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  const score = payload[0].value
  return (
    <div className="rounded-lg border border-dark-700/60 bg-dark-800/95 px-3 py-2 shadow-xl">
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className={cn('text-lg font-bold font-mono', getScoreColor(score))}>{score} pts</p>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

interface PainelEvolucaoProps {
  familyId: string
}

export function PainelEvolucao({ familyId }: PainelEvolucaoProps) {
  const [pocksData, setPocksData] = useState<PocksData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    carregarDadosPocks(familyId)
      .then((data) => {
        setPocksData(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Não foi possível carregar os dados de Pocks.')
        setLoading(false)
      })
  }, [familyId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
      </div>
    )
  }

  if (error || !pocksData) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error ?? 'Sem dados disponíveis para este cliente.'}</p>
        </div>
      </div>
    )
  }

  const { mesAtual, historico } = pocksData

  // Build chart data (historico oldest→newest + mesAtual)
  const chartData = [...historico, mesAtual].map((m) => ({
    mes: getMesLabel(m.mes_referencia),
    score: m.total_score,
    ref: m.mes_referencia,
  }))

  // Previous month for delta calculation
  const prevMonth = historico.length > 0 ? historico[historico.length - 1] : null

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-100">Painel de Evolução Pocks</h3>
          <p className="text-xs text-gray-500 mt-0.5">Histórico mensal detalhado por critério</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Score atual</p>
          <p className={cn('text-3xl font-bold font-mono', getScoreColor(mesAtual.total_score))}>
            {mesAtual.total_score}
          </p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">Evolução histórica</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="mes"
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 110]}
                tick={{ fill: '#6b7280', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#7C3AED"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#7C3AED', strokeWidth: 0 }}
                activeDot={{ r: 6, fill: '#A78BFA' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Criteria breakdown */}
      <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-5 space-y-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Critérios — mês atual</p>

        {CRITERIOS.map(({ key, label, peso }) => {
          const current = mesAtual.criteria_breakdown[key]
          const prev = prevMonth?.criteria_breakdown[key]
          const delta = prev ? current.score - prev.score : 0
          const pct = current.max_score > 0 ? Math.round((current.score / current.max_score) * 100) : 0

          return (
            <div key={key} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm text-gray-300 truncate">{label}</span>
                  <span className="text-[10px] text-gray-600 shrink-0">{peso}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <DeltaBadge delta={delta} />
                  <span className="text-sm font-semibold font-mono text-gray-200 tabular-nums w-14 text-right">
                    {current.score}/{current.max_score}
                  </span>
                </div>
              </div>
              <ScoreBar value={current.score} max={current.max_score} />
            </div>
          )
        })}
      </div>

      {/* Bonuses */}
      {mesAtual.bonuses.length > 0 && (
        <div className="rounded-xl border border-secondary-500/20 bg-secondary-500/5 p-5 space-y-2">
          <p className="text-xs font-medium text-secondary-400 uppercase tracking-wider">Bônus ativos</p>
          {mesAtual.bonuses.map((bonus, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <p className="text-sm text-gray-300">{bonus.description}</p>
              <span className="text-sm font-semibold text-secondary-400 font-mono shrink-0">+{bonus.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Streak */}
      {pocksData.streakAtual > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-semibold text-amber-300">Sequência ativa</p>
              <p className="text-xs text-gray-500">Melhor: {pocksData.melhorStreak} meses</p>
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-300">{pocksData.streakAtual}🔥</p>
        </div>
      )}
    </div>
  )
}
