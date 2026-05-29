import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronRight, ChevronLeft, CheckCircle2, Loader2, Clock, DollarSign, Target, TrendingDown, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'
import {
  consultorModuleService,
  calcularComprometimento,
  type ConsultorDiagnostic,
  type CreateDiagnosticInput,
} from '../../services/consultorModuleService'
import { cn } from '../../lib/cn'

// ── Helpers ──────────────────────────────────────────────────

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ComprometimentoBadge({ percentual }: { percentual: number }) {
  const isOk = percentual <= 50
  const isAlert = percentual > 50 && percentual <= 70
  const isCritical = percentual > 70

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-semibold',
        isOk && 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
        isAlert && 'bg-amber-500/10 border border-amber-500/20 text-amber-400',
        isCritical && 'bg-red-500/10 border border-red-500/20 text-red-400'
      )}
    >
      {percentual.toFixed(1)}%
      {isOk && ' — Saudável'}
      {isAlert && ' — Atenção'}
      {isCritical && ' — Crítico'}
    </span>
  )
}

// ── Types ────────────────────────────────────────────────────

interface GoalDraft {
  descricao: string
  prazo_meses: string
  valor_alvo: string
}

interface WizardData {
  renda_liquida: string
  gastos_fixos: string
  total_parcelas: string
  goals: GoalDraft[]
}

const EMPTY_GOAL: GoalDraft = { descricao: '', prazo_meses: '', valor_alvo: '' }

const INITIAL_DATA: WizardData = {
  renda_liquida: '',
  gastos_fixos: '',
  total_parcelas: '',
  goals: [{ ...EMPTY_GOAL }],
}

// ── Step components ──────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1.5 rounded-full transition-all duration-300',
            i < current ? 'bg-primary-500 w-6' :
            i === current ? 'bg-primary-400 w-10' :
            'bg-dark-600 w-6'
          )}
        />
      ))}
      <span className="text-xs text-gray-500 ml-1">{current + 1}/{total}</span>
    </div>
  )
}

function CurrencyInput({
  label,
  value,
  onChange,
  hint,
  placeholder = 'R$ 0,00',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  placeholder?: string
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    const cents = parseInt(raw || '0', 10)
    const formatted = (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    })
    onChange(formatted === 'R$\xa00,00' ? '' : formatted)
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 rounded-xl bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 focus:ring-1 focus:ring-primary-500/20 transition-all text-lg font-mono"
      />
      {hint && <p className="text-xs text-gray-500">{hint}</p>}
    </div>
  )
}

function parseBRL(value: string): number {
  return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

// ── Step 1: Renda ─────────────────────────────────────────────

function StepRenda({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <DollarSign className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-100 text-lg">Renda do Núcleo Familiar</h3>
          <p className="text-sm text-gray-500 mt-0.5">Soma de todos os rendimentos líquidos da família no mês</p>
        </div>
      </div>

      <CurrencyInput
        label="Renda líquida mensal total"
        value={data.renda_liquida}
        onChange={(v) => onChange({ ...data, renda_liquida: v })}
        hint="Inclua salários, freelances, aluguéis recebidos e outras rendas regulares — já descontados impostos."
      />
    </div>
  )
}

// ── Step 2: Gastos Fixos ──────────────────────────────────────

function StepGastosFixos({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <TrendingDown className="w-5 h-5 text-secondary-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-100 text-lg">Gastos Fixos Recorrentes</h3>
          <p className="text-sm text-gray-500 mt-0.5">Despesas que ocorrem todo mês com valor previsível</p>
        </div>
      </div>

      <CurrencyInput
        label="Total de gastos fixos mensais"
        value={data.gastos_fixos}
        onChange={(v) => onChange({ ...data, gastos_fixos: v })}
        hint="Ex: aluguel, condomínio, escola, plano de saúde, academia, streaming, contas de serviços (água, luz, internet)."
      />

      <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-4 space-y-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Exemplos de gastos fixos</p>
        {[
          'Aluguel / financiamento imóvel',
          'Escola / faculdade dos filhos',
          'Plano de saúde',
          'Contas de serviços (luz, água, internet)',
          'Academia, streaming, assinaturas',
        ].map((ex) => (
          <p key={ex} className="text-xs text-gray-500 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-dark-500 shrink-0" />
            {ex}
          </p>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Parcelas de dívidas</p>
        <p className="text-xs text-gray-500">As parcelas de dívidas são cadastradas separadamente na próxima etapa.</p>
        <CurrencyInput
          label="Total das parcelas mensais de dívidas (se houver)"
          value={data.total_parcelas}
          onChange={(v) => onChange({ ...data, total_parcelas: v })}
          hint="Cartão, empréstimo pessoal, financiamento de carro — valor total das parcelas que pagam por mês."
        />
      </div>

      {/* Preview comprometimento */}
      {parseBRL(data.renda_liquida) > 0 && parseBRL(data.gastos_fixos) > 0 && (
        <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-4">
          <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Prévia do comprometimento</p>
          <ComprometimentoBadge
            percentual={
              calcularComprometimento(
                parseBRL(data.renda_liquida),
                parseBRL(data.gastos_fixos),
                parseBRL(data.total_parcelas)
              ).percentual
            }
          />
          <p className="text-xs text-gray-500 mt-2">
            Saldo disponível:{' '}
            <span className="text-gray-300 font-mono">
              {formatBRL(
                calcularComprometimento(
                  parseBRL(data.renda_liquida),
                  parseBRL(data.gastos_fixos),
                  parseBRL(data.total_parcelas)
                ).saldoDisponivel
              )}
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

// ── Step 3: Metas ─────────────────────────────────────────────

function StepMetas({ data, onChange }: { data: WizardData; onChange: (d: WizardData) => void }) {
  const addGoal = () =>
    onChange({ ...data, goals: [...data.goals, { ...EMPTY_GOAL }] })

  const removeGoal = (i: number) =>
    onChange({ ...data, goals: data.goals.filter((_, idx) => idx !== i) })

  const updateGoal = (i: number, field: keyof GoalDraft, value: string) => {
    const updated = data.goals.map((g, idx) => (idx === i ? { ...g, [field]: value } : g))
    onChange({ ...data, goals: updated })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-secondary-500/10 border border-secondary-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <Target className="w-5 h-5 text-secondary-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-100 text-lg">Metas Prioritárias</h3>
          <p className="text-sm text-gray-500 mt-0.5">O que o cliente quer conquistar com a consultoria</p>
        </div>
      </div>

      <div className="space-y-3">
        {data.goals.map((goal, i) => (
          <div
            key={i}
            className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Meta {i + 1}
              </span>
              {data.goals.length > 1 && (
                <button
                  onClick={() => removeGoal(i)}
                  className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-300">Descrição da meta</label>
              <input
                type="text"
                value={goal.descricao}
                onChange={(e) => updateGoal(i, 'descricao', e.target.value)}
                placeholder="Ex: Quitar dívida do cartão, fazer reserva de emergência…"
                className="w-full px-3 py-2.5 rounded-lg bg-dark-900/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-400">Prazo (meses)</label>
                <input
                  type="number"
                  min="1"
                  max="240"
                  value={goal.prazo_meses}
                  onChange={(e) => updateGoal(i, 'prazo_meses', e.target.value)}
                  placeholder="Ex: 12"
                  className="w-full px-3 py-2 rounded-lg bg-dark-900/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-gray-400">Valor alvo (opcional)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={goal.valor_alvo}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '')
                    const cents = parseInt(raw || '0', 10)
                    const fmt = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                    updateGoal(i, 'valor_alvo', raw === '' ? '' : fmt === 'R$\xa00,00' ? '' : fmt)
                  }}
                  placeholder="R$ 0,00"
                  className="w-full px-3 py-2 rounded-lg bg-dark-900/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm font-mono transition-all"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={addGoal}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-dark-600 text-gray-500 hover:text-gray-300 hover:border-dark-500 transition-all text-sm"
      >
        <Plus className="w-4 h-4" />
        Adicionar meta
      </button>
    </div>
  )
}

// ── Step 4: Resumo / Confirmação ──────────────────────────────

function StepResumo({ data }: { data: WizardData }) {
  const renda = parseBRL(data.renda_liquida)
  const fixos = parseBRL(data.gastos_fixos)
  const parcelas = parseBRL(data.total_parcelas)
  const { percentual, saldoDisponivel } = calcularComprometimento(renda, fixos, parcelas)

  const validGoals = data.goals.filter((g) => g.descricao.trim())

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-100 text-lg">Resumo do Diagnóstico</h3>
          <p className="text-sm text-gray-500 mt-0.5">Revise antes de salvar</p>
        </div>
      </div>

      {/* Financial summary */}
      <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-5 space-y-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Quadro Financeiro</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Renda líquida', value: formatBRL(renda), color: 'text-emerald-400' },
            { label: 'Gastos fixos', value: formatBRL(fixos), color: 'text-amber-400' },
            { label: 'Parcelas dívidas', value: formatBRL(parcelas), color: 'text-red-400' },
            { label: 'Saldo disponível', value: formatBRL(saldoDisponivel), color: saldoDisponivel >= 0 ? 'text-primary-400' : 'text-red-400' },
          ].map((item) => (
            <div key={item.label} className="space-y-1">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className={cn('font-semibold font-mono', item.color)}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-dark-700/40">
          <p className="text-xs text-gray-500 mb-2">Comprometimento de renda</p>
          <ComprometimentoBadge percentual={percentual} />
        </div>
      </div>

      {/* Goals summary */}
      {validGoals.length > 0 && (
        <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-5 space-y-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Metas ({validGoals.length})</p>
          {validGoals.map((g, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-primary-400">{i + 1}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-200">{g.descricao}</p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {g.prazo_meses && (
                    <p className="text-xs text-gray-500">{g.prazo_meses} meses</p>
                  )}
                  {g.valor_alvo && (
                    <p className="text-xs text-gray-500 font-mono">{g.valor_alvo}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── DiagnosticoCard (resultado salvo) ─────────────────────────

function DiagnosticoCard({
  diagnostic,
  onNew,
}: {
  diagnostic: ConsultorDiagnostic
  onNew: () => void
}) {
  const { percentual_comprometimento, saldo_disponivel, renda_liquida_mensal, gastos_fixos_mensais, total_parcelas_dividas } = diagnostic

  const date = new Date(diagnostic.created_at)
  const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Diagnóstico mais recente</p>
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs text-gray-500">{dateStr}</span>
          </div>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-all text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Novo diagnóstico
        </button>
      </div>

      {/* Comprometimento destaque */}
      {percentual_comprometimento !== null && (
        <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Comprometimento de renda</p>
          <ComprometimentoBadge percentual={percentual_comprometimento} />
        </div>
      )}

      {/* Numbers grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Renda líquida', value: formatBRL(renda_liquida_mensal), color: 'text-emerald-400' },
          { label: 'Gastos fixos', value: formatBRL(gastos_fixos_mensais), color: 'text-amber-400' },
          { label: 'Parcelas dívidas', value: formatBRL(total_parcelas_dividas), color: 'text-red-400' },
          {
            label: 'Saldo disponível',
            value: saldo_disponivel !== null ? formatBRL(saldo_disponivel) : '—',
            color: (saldo_disponivel ?? 0) >= 0 ? 'text-primary-400' : 'text-red-400',
          },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-4">
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className={cn('font-semibold font-mono text-sm', item.color)}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Goals */}
      {diagnostic.goals && diagnostic.goals.length > 0 && (
        <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-5 space-y-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Metas cadastradas</p>
          {[...diagnostic.goals]
            .sort((a, b) => a.prioridade - b.prioridade)
            .map((g, i) => (
              <div key={g.id} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary-400">{i + 1}</span>
                </div>
                <div>
                  <p className="text-sm text-gray-200">{g.descricao}</p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {g.prazo_meses && <p className="text-xs text-gray-500">{g.prazo_meses} meses</p>}
                    {g.valor_alvo && (
                      <p className="text-xs text-gray-500 font-mono">{formatBRL(g.valor_alvo)}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

const STEPS = ['Renda', 'Gastos & Dívidas', 'Metas', 'Revisão']

interface DiagnosticoWizardProps {
  familyId: string
}

export function DiagnosticoWizard({ familyId }: DiagnosticoWizardProps) {
  const { user } = useAuth()
  const [latestDiagnostic, setLatestDiagnostic] = useState<ConsultorDiagnostic | null>(null)
  const [loadingDiag, setLoadingDiag] = useState(true)
  const [showWizard, setShowWizard] = useState(false)

  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardData>(INITIAL_DATA)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoadingDiag(true)
    consultorModuleService.getLatestDiagnostic(familyId).then(({ data: d }) => {
      setLatestDiagnostic(d)
      setLoadingDiag(false)
      if (!d) setShowWizard(true)
    })
  }, [familyId])

  const canAdvance = () => {
    if (step === 0) return parseBRL(data.renda_liquida) > 0
    if (step === 1) return parseBRL(data.gastos_fixos) > 0
    if (step === 2) return data.goals.some((g) => g.descricao.trim())
    return true
  }

  const handleSave = async () => {
    if (!user) return
    setSaving(true)

    const goalsForSave = data.goals
      .filter((g) => g.descricao.trim())
      .map((g, i) => ({
        descricao: g.descricao,
        prazo_meses: g.prazo_meses ? parseInt(g.prazo_meses) : null,
        valor_alvo: g.valor_alvo ? parseBRL(g.valor_alvo) : null,
        prioridade: i + 1,
      }))

    const input: CreateDiagnosticInput = {
      family_id: familyId,
      renda_liquida_mensal: parseBRL(data.renda_liquida),
      gastos_fixos_mensais: parseBRL(data.gastos_fixos),
      total_parcelas_dividas: parseBRL(data.total_parcelas),
      goals: goalsForSave,
    }

    const { data: saved, error } = await consultorModuleService.createDiagnostic(input, user.id)

    if (error) {
      toast.error('Erro ao salvar diagnóstico')
      setSaving(false)
      return
    }

    setLatestDiagnostic(saved)
    setShowWizard(false)
    setStep(0)
    setData(INITIAL_DATA)
    toast.success('Diagnóstico salvo com sucesso')
    setSaving(false)
  }

  if (loadingDiag) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
      </div>
    )
  }

  // Show existing diagnostic
  if (!showWizard && latestDiagnostic) {
    return (
      <div className="p-6">
        <DiagnosticoCard
          diagnostic={latestDiagnostic}
          onNew={() => {
            setShowWizard(true)
            setStep(0)
            setData(INITIAL_DATA)
          }}
        />
      </div>
    )
  }

  // Wizard
  return (
    <div className="p-6 space-y-6">
      {/* Header with step indicator */}
      <div className="flex items-center justify-between gap-4">
        <h3 className="font-medium text-gray-200">
          {latestDiagnostic ? 'Novo Diagnóstico' : 'Diagnóstico Inicial'}
        </h3>
        <StepIndicator current={step} total={STEPS.length} />
      </div>

      {/* Step labels */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={cn(
              'flex-1 text-center text-[10px] font-medium py-1 rounded transition-all',
              i === step ? 'text-primary-400 bg-primary-500/10' : i < step ? 'text-gray-400' : 'text-gray-600'
            )}
          >
            {s}
          </span>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[280px]">
        {step === 0 && <StepRenda data={data} onChange={setData} />}
        {step === 1 && <StepGastosFixos data={data} onChange={setData} />}
        {step === 2 && <StepMetas data={data} onChange={setData} />}
        {step === 3 && <StepResumo data={data} />}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-dark-700/40">
        <div className="flex gap-2">
          {latestDiagnostic && (
            <button
              onClick={() => setShowWizard(false)}
              className="px-4 py-2 rounded-lg border border-dark-600 text-gray-500 hover:text-gray-300 transition-all text-sm"
            >
              Cancelar
            </button>
          )}
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-dark-600 text-gray-400 hover:text-gray-200 transition-all text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Voltar
            </button>
          )}
        </div>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canAdvance()}
            className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-all"
          >
            Próximo
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-sm font-medium transition-all"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Salvar diagnóstico
          </button>
        )}
      </div>
    </div>
  )
}
