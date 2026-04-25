import { useState, useEffect, useCallback } from 'react'
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Calendar,
  Clock,
  BarChart2,
  ArrowLeftRight,
  Package,
  ChevronDown,
  ChevronUp,
  Star,
  Flame,
  RefreshCw,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip,
} from 'recharts'
import { usePlan } from '../hooks/usePlan'
import { useConsultorPermissions } from '../hooks/useConsultorPermissions'
import { FeaturePreview } from '../components/FeaturePreview'
import { FeatureCTA } from '../components/FeatureCTA'
import { useAuth } from '../contexts/AuthContext'
import {
  carregarDadosPocks,
  getScoreColor,
  getScoreLabel,
  getBarColor,
  getMesLabel,
  getMesLabelLong,
  type PocksData,
  type PocksMonthResult,
  type CriteriaBreakdown,
} from '../services/pocksService'

// ============================================================
// CONFIGURAÇÃO DOS CRITÉRIOS
// ============================================================

const CRITERIOS_CONFIG = [
  {
    key: 'budget_adherence' as keyof CriteriaBreakdown,
    label: 'Orçamento Geral',
    peso: '35%',
    icon: Target,
    color: 'text-primary-400',
    bgColor: 'bg-primary-500/10',
    borderColor: 'border-primary-500/30',
    barColor: 'bg-primary-500',
    dica: 'Fica dentro do total orçado para o mês? Esse é o critério mais importante — representa 35% da nota.',
  },
  {
    key: 'early_planning' as keyof CriteriaBreakdown,
    label: 'Planejamento Antecipado',
    peso: '20%',
    icon: Calendar,
    color: 'text-secondary-400',
    bgColor: 'bg-secondary-500/10',
    borderColor: 'border-secondary-500/30',
    barColor: 'bg-secondary-500',
    dica: 'Quanto antes o orçamento for criado, maior a nota. Criar antes do início do mês dá nota máxima.',
  },
  {
    key: 'entry_timeliness' as keyof CriteriaBreakdown,
    label: 'Pontualidade nos Lançamentos',
    peso: '15%',
    icon: Clock,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    barColor: 'bg-blue-500',
    dica: 'Mede o tempo entre a data real do gasto e quando ele foi registrado no app. Lance no mesmo dia para nota máxima.',
  },
  {
    key: 'entry_consistency' as keyof CriteriaBreakdown,
    label: 'Consistência de Uso',
    peso: '10%',
    icon: BarChart2,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    barColor: 'bg-amber-500',
    dica: 'Em quantos dias distintos do mês você registrou lançamentos? Usar o app regularmente vale mais que lançar tudo de uma vez.',
  },
  {
    key: 'smart_rebalancing' as keyof CriteriaBreakdown,
    label: 'Rebalanceamentos',
    peso: '10%',
    icon: ArrowLeftRight,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    barColor: 'bg-orange-500',
    dica: '1 a 3 rebalanceamentos é o ideal — mostra engajamento ativo sem indicar caos no planejamento.',
  },
  {
    key: 'envelope_coverage' as keyof CriteriaBreakdown,
    label: 'Cobertura de Envelopes',
    peso: '10%',
    icon: Package,
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    barColor: 'bg-green-500',
    dica: 'Porcentagem das despesas que estão associadas a algum envelope do orçamento. 100% = tudo categorizado.',
  },
]

// ============================================================
// SUB-COMPONENTES
// ============================================================

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-gray-400">Calculando seus Pocks...</p>
    </div>
  )
}

function ScoreBadge({ score, prevScore }: { score: number; prevScore?: number }) {
  if (prevScore === undefined) return null
  const diff = score - prevScore
  if (diff === 0) return null
  const isPositive = diff > 0
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
        isPositive
          ? 'bg-green-500/20 text-green-400'
          : 'bg-red-500/20 text-red-400'
      }`}
    >
      {isPositive ? '+' : ''}{diff} vs mês anterior
    </span>
  )
}

function ProgressBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  const bounded = Math.min(100, Math.max(0, pct))
  return (
    <div className="w-full h-1.5 bg-dark-700 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
        style={{ width: `${bounded}%` }}
      />
    </div>
  )
}

function CriterioCard({
  config,
  criterio,
}: {
  config: typeof CRITERIOS_CONFIG[number]
  criterio: { score: number; max: number; detail: string }
}) {
  const [expanded, setExpanded] = useState(false)
  const pct = (criterio.score / criterio.max) * 100
  const barColor = pct >= 80 ? config.barColor : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  const Icon = config.icon

  return (
    <div className={`rounded-xl border ${config.borderColor} ${config.bgColor} overflow-hidden`}>
      <button
        className="w-full px-4 py-3 flex items-center gap-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className={`w-8 h-8 rounded-lg bg-dark-800/50 flex items-center justify-center shrink-0`}>
          <Icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-200">{config.label}</span>
              <span className="text-xs text-gray-500">{config.peso}</span>
            </div>
            <span className={`text-sm font-bold ${config.color}`}>
              {criterio.score}/{criterio.max}
            </span>
          </div>
          <ProgressBar pct={pct} colorClass={barColor} />
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500 shrink-0 ml-1" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 ml-1" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2 border-t border-dark-700/50 pt-3">
          <p className="text-sm text-gray-300">{criterio.detail}</p>
          <p className="text-xs text-gray-500 italic">{config.dica}</p>
        </div>
      )}
    </div>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const score = payload[0]?.value ?? 0
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-gray-400 mb-0.5">{label}</p>
      <p className={`font-bold text-base ${getScoreColor(score)}`}>
        {score} Pocks
      </p>
      <p className="text-xs text-gray-500">{getScoreLabel(score)}</p>
    </div>
  )
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export function Pocks() {
  const { featureAccess } = usePlan()
  const pocksAccess = featureAccess('pocks')
  const { isConsultor } = useConsultorPermissions()
  const { activeFamilyId } = useAuth()

  const [dados, setDados] = useState<PocksData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null) // null = mês atual

  const carregar = useCallback(async () => {
    if (!activeFamilyId) return
    setIsLoading(true)
    setLoadError(null)
    try {
      // Timeout de 45s para evitar loading infinito em caso de query travada
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 45_000))
      const result = await Promise.race([carregarDadosPocks(activeFamilyId), timeout])
      if (result === null) {
        // Timeout ou sem dados — verificar se é timeout
        setLoadError('timeout')
      }
      setDados(result)
    } catch (e) {
      console.error('Erro ao carregar Pocks:', e)
      setLoadError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setIsLoading(false)
    }
  }, [activeFamilyId])

  // Consultores têm acesso aos Pocks do cliente independente do próprio plano
  useEffect(() => {
    if ((pocksAccess === 'full' || isConsultor) && activeFamilyId) carregar()
  }, [pocksAccess, isConsultor, activeFamilyId, carregar])

  // ---- Derivados ----

  const allMonths: PocksMonthResult[] = dados
    ? [...dados.historico, dados.mesAtual]
    : []

  // Mês exibido na seção de breakdown (default: mês atual)
  const displayedMonth: PocksMonthResult | null =
    selectedIdx !== null ? (allMonths[selectedIdx] ?? null) : dados?.mesAtual ?? null

  const prevMonthScore: number | undefined =
    selectedIdx !== null
      ? allMonths[selectedIdx - 1]?.total_score
      : dados?.historico[dados.historico.length - 1]?.total_score

  const chartData = allMonths
    .filter((m) => m.had_orcamento || m === dados?.mesAtual)
    .map((m, i) => ({
      label: getMesLabel(m.mes_referencia),
      score: m.total_score,
      isCurrent: i === allMonths.length - 1,
    }))

  // ---- Renderização ----

  if (!isConsultor && pocksAccess === 'preview') {
    return (
      <FeaturePreview
        feature="pocks"
        title="Pocks — Saúde Financeira"
        subtitle="Seu score de saúde financeira, atualizado todo mês"
        requiredTier="planejador"
      >
        <LoadingState />
      </FeaturePreview>
    )
  }
  if (!isConsultor && pocksAccess === 'locked') return <FeatureCTA feature="pocks" />

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-secondary-500/30 to-primary-500/30 border border-secondary-500/20 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-secondary-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold gradient-text">Pocks</h1>
              <span className="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary-500/20 text-secondary-400">
                Beta
              </span>
            </div>
            <p className="text-xs text-gray-500">Saúde Financeira</p>
          </div>
        </div>
        <button
          onClick={carregar}
          disabled={isLoading}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-dark-800 transition-colors disabled:opacity-50"
          title="Recalcular"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* LOADING */}
      {isLoading && !dados && <LoadingState />}

      {/* SEM DADOS */}
      {!isLoading && !dados && (
        <div className="text-center py-16">
          <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          {loadError ? (
            <>
              <p className="text-gray-400">Não foi possível carregar os dados do Pocks.</p>
              <p className="text-gray-500 text-sm mt-1 font-mono text-xs">{loadError}</p>
              <button
                onClick={carregar}
                className="mt-4 px-4 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 text-sm transition-all"
              >
                Tentar novamente
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-400">Nenhum orçamento encontrado.</p>
              <p className="text-gray-500 text-sm mt-1">
                Crie seu primeiro orçamento em Envelopes para começar a pontuar!
              </p>
            </>
          )}
        </div>
      )}

      {dados && (
        <div className="lg:grid lg:grid-cols-5 lg:gap-8 space-y-6 lg:space-y-0">

          {/* ── COLUNA ESQUERDA (critérios + score + streak + seletor) ── */}
          <div className="lg:col-span-3 space-y-6">

            {/* SCORE CARDS */}
            <div className="grid grid-cols-2 gap-4">

              {/* Score Mensal */}
              <div className="col-span-2 sm:col-span-1 rounded-2xl bg-gradient-to-br from-secondary-500/20 to-primary-500/20 border border-secondary-500/20 p-5 relative overflow-hidden">
                <div className="absolute inset-0 bg-dark-900/40 rounded-2xl" />
                <div className="relative z-10">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                    {getMesLabelLong(dados.mesAtual.mes_referencia)}
                  </p>
                  <div className="flex items-end gap-2 mb-2">
                    <span className={`text-6xl font-black leading-none ${getScoreColor(dados.mesAtual.total_score)}`}>
                      {dados.mesAtual.total_score}
                    </span>
                    <span className="text-lg text-gray-400 mb-1">Pocks</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${getScoreColor(dados.mesAtual.total_score)}`}>
                      {getScoreLabel(dados.mesAtual.total_score)}
                    </span>
                    <ScoreBadge score={dados.mesAtual.total_score} prevScore={prevMonthScore} />
                  </div>
                </div>
              </div>

              {/* Score Geral */}
              <div className="col-span-2 sm:col-span-1 rounded-2xl bg-dark-800/50 border border-dark-700/50 p-5">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                  Geral · {allMonths.filter((m) => m.had_orcamento).length} meses
                </p>
                <div className="flex items-end gap-2 mb-2">
                  <span className={`text-5xl font-black leading-none ${getScoreColor(dados.scoreGeral)}`}>
                    {dados.scoreGeral}
                  </span>
                  <span className="text-base text-gray-400 mb-1">Pocks</span>
                </div>
                <div className="flex items-center gap-2">
                  {dados.tendencia === 'alta' && (
                    <span className="flex items-center gap-1 text-green-400 text-sm font-medium">
                      <TrendingUp className="w-4 h-4" /> Tendência de alta
                    </span>
                  )}
                  {dados.tendencia === 'queda' && (
                    <span className="flex items-center gap-1 text-red-400 text-sm font-medium">
                      <TrendingDown className="w-4 h-4" /> Tendência de queda
                    </span>
                  )}
                  {dados.tendencia === 'estavel' && (
                    <span className="flex items-center gap-1 text-gray-400 text-sm">
                      <Minus className="w-4 h-4" /> Estável
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* STREAK BANNER */}
            {dados.streakAtual >= 2 && (
              <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-300">
                    {dados.streakAtual} meses consecutivos dentro do orçamento!
                  </p>
                  <p className="text-xs text-amber-500/80 mt-0.5">
                    Streak ativa —{' '}
                    {dados.mesAtual.bonuses.find((b) => b.type === 'streak')
                      ? `bônus de +${dados.mesAtual.bonuses.find((b) => b.type === 'streak')!.value} Pocks aplicado`
                      : 'continue assim!'
                    }
                    {dados.melhorStreak > dados.streakAtual && (
                      <> · Recorde: {dados.melhorStreak} meses</>
                    )}
                  </p>
                </div>
              </div>
            )}
            {dados.streakAtual <= 1 && (
              <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-dark-700 flex items-center justify-center shrink-0">
                  <Flame className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400">Sem streak ativa</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Fique dentro do orçamento este mês para iniciar uma sequência e ganhar bônus!
                    {dados.melhorStreak > 1 && ` Seu recorde foi de ${dados.melhorStreak} meses.`}
                  </p>
                </div>
              </div>
            )}

            {/* SELETOR DE MÊS PARA O BREAKDOWN */}
            {allMonths.length > 1 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Ver breakdown do mês</p>
                <div className="flex gap-2 flex-wrap">
                  {allMonths.map((m, i) => {
                    const isCurrent = i === allMonths.length - 1
                    const isSelected = selectedIdx === null ? isCurrent : selectedIdx === i
                    return (
                      <button
                        key={m.mes_referencia}
                        onClick={() => setSelectedIdx(isCurrent ? null : i)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-primary-500/20 text-primary-400 border border-primary-500/50'
                            : 'bg-dark-800 text-gray-400 border border-dark-700 hover:border-dark-600'
                        }`}
                      >
                        {getMesLabel(m.mes_referencia)}
                        {isCurrent && (
                          <span className="ml-1 text-[9px] text-gray-500">atual</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* BREAKDOWN DOS CRITÉRIOS */}
            {displayedMonth && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                    Critérios
                  </h2>
                  <span className="text-xs text-gray-500">
                    {getMesLabelLong(displayedMonth.mes_referencia)}
                  </span>
                </div>

                {displayedMonth.had_orcamento ? (
                  <>
                    {CRITERIOS_CONFIG.map((config) => (
                      <CriterioCard
                        key={config.key}
                        config={config}
                        criterio={displayedMonth.criteria_breakdown[config.key]}
                      />
                    ))}
                  </>
                ) : (
                  <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-6 text-center">
                    <p className="text-gray-500 text-sm">Nenhum orçamento definido para este mês.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── COLUNA DIREITA (gráfico + bônus + faixas) ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* HISTÓRICO — GRÁFICO */}
            {chartData.length > 1 && (
              <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                  Evolução Mensal
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} barCategoryGap="30%">
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 115]}
                      tick={{ fill: '#6b7280', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={28}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={getBarColor(entry.score)}
                          opacity={entry.isCurrent ? 1 : 0.55}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* BÔNUS E AJUSTES */}
            {displayedMonth && displayedMonth.bonuses.length > 0 && (
              <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                  Bônus Aplicados
                </h2>
                <div className="space-y-2">
                  {displayedMonth.bonuses.map((bonus, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {bonus.type === 'streak' ? (
                          <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : (
                          <Star className="w-4 h-4 text-green-400 shrink-0" />
                        )}
                        <span className="text-sm text-gray-300">{bonus.description}</span>
                      </div>
                      <span className="text-sm font-bold text-green-400">+{bonus.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LEGENDA DE FAIXAS */}
            <div className="rounded-xl bg-dark-800/50 border border-dark-700/50 p-4">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                Faixas de Score
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Crítico',   range: '0–40',    color: 'bg-red-500/20 text-red-400 border-red-500/30' },
                  { label: 'Atenção',   range: '41–60',   color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
                  { label: 'Bom',       range: '61–80',   color: 'bg-primary-500/20 text-primary-400 border-primary-500/30' },
                  { label: 'Excelente', range: '81–100+', color: 'bg-secondary-500/20 text-secondary-400 border-secondary-500/30' },
                ].map(({ label, range, color }) => (
                  <div key={label} className={`rounded-lg border px-3 py-2 text-center ${color}`}>
                    <p className="text-xs font-bold">{label}</p>
                    <p className="text-xs opacity-70">{range}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
