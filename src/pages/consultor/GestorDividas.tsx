import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit3, Check, Loader2, CreditCard, TrendingDown, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  consultorModuleService,
  sugerirEnvelopeMensal,
  type ConsultorDebt,
  type CreateDebtInput,
} from '../../services/consultorModuleService'
import { cn } from '../../lib/cn'

// ── Helpers ──────────────────────────────────────────────────

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseBRL(v: string): number {
  return parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

function fmtCurrency(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const cents = parseInt(digits || '0', 10)
  const f = (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return f === 'R$\xa00,00' ? '' : f
}

function statusLabel(s: ConsultorDebt['status']) {
  if (s === 'quitada') return 'Quitada'
  if (s === 'renegociada') return 'Renegociada'
  return 'Ativa'
}

function statusColor(s: ConsultorDebt['status']) {
  if (s === 'quitada') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (s === 'renegociada') return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  return 'text-red-400 bg-red-500/10 border-red-500/20'
}

// ── Debt form ─────────────────────────────────────────────────

interface DebtFormData {
  credor: string
  saldo_devedor: string
  taxa_juros: string
  taxa_juros_tipo: 'mensal' | 'anual'
  parcelas_restantes: string
  valor_parcela: string
  data_vencimento: string
  envelope_ajustado: string
}

const EMPTY_FORM: DebtFormData = {
  credor: '',
  saldo_devedor: '',
  taxa_juros: '',
  taxa_juros_tipo: 'mensal',
  parcelas_restantes: '',
  valor_parcela: '',
  data_vencimento: '',
  envelope_ajustado: '',
}

function DebtForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: DebtFormData
  onSave: (d: DebtFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<DebtFormData>(initial ?? EMPTY_FORM)

  const suggestedValue = sugerirEnvelopeMensal({
    saldo_devedor: parseBRL(form.saldo_devedor),
    taxa_juros: form.taxa_juros ? parseFloat(form.taxa_juros) : null,
    taxa_juros_tipo: form.taxa_juros_tipo,
    parcelas_restantes: form.parcelas_restantes ? parseInt(form.parcelas_restantes) : null,
    valor_parcela: parseBRL(form.valor_parcela),
  })

  const isValid = form.credor.trim() && parseBRL(form.saldo_devedor) > 0

  return (
    <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-5 space-y-4">
      <p className="text-xs font-medium text-primary-400 uppercase tracking-wider">
        {initial ? 'Editar dívida' : 'Nova dívida'}
      </p>

      {/* Credor */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">Credor *</label>
        <input
          type="text"
          value={form.credor}
          onChange={(e) => setForm({ ...form, credor: e.target.value })}
          placeholder="Ex: Nubank, Banco do Brasil, Caixa…"
          className="w-full px-3 py-2.5 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm transition-all"
        />
      </div>

      {/* Saldo devedor */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">Saldo devedor *</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.saldo_devedor}
            onChange={(e) => setForm({ ...form, saldo_devedor: fmtCurrency(e.target.value) })}
            placeholder="R$ 0,00"
            className="w-full px-3 py-2.5 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm font-mono transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-300">Valor da parcela</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.valor_parcela}
            onChange={(e) => setForm({ ...form, valor_parcela: fmtCurrency(e.target.value) })}
            placeholder="R$ 0,00"
            className="w-full px-3 py-2.5 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm font-mono transition-all"
          />
        </div>
      </div>

      {/* Juros + parcelas */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-400">Taxa de juros</label>
          <input
            type="number"
            step="0.01"
            value={form.taxa_juros}
            onChange={(e) => setForm({ ...form, taxa_juros: e.target.value })}
            placeholder="0,00"
            className="w-full px-3 py-2 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm transition-all"
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-400">Tipo</label>
          <select
            value={form.taxa_juros_tipo}
            onChange={(e) => setForm({ ...form, taxa_juros_tipo: e.target.value as 'mensal' | 'anual' })}
            className="w-full px-3 py-2 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 focus:outline-none focus:border-primary-500/60 text-sm transition-all"
          >
            <option value="mensal">% a.m.</option>
            <option value="anual">% a.a.</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-gray-400">Parcelas restantes</label>
          <input
            type="number"
            min="1"
            value={form.parcelas_restantes}
            onChange={(e) => setForm({ ...form, parcelas_restantes: e.target.value })}
            placeholder="Ex: 18"
            className="w-full px-3 py-2 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm transition-all"
          />
        </div>
      </div>

      {/* Vencimento */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-gray-400">Data de vencimento (opcional)</label>
        <input
          type="date"
          value={form.data_vencimento}
          onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 focus:outline-none focus:border-primary-500/60 text-sm transition-all"
        />
      </div>

      {/* Envelope suggestion */}
      {suggestedValue > 0 && (
        <div className="rounded-lg border border-secondary-500/20 bg-secondary-500/5 p-3">
          <p className="text-xs text-secondary-400 mb-2 font-medium">Envelope mensal sugerido</p>
          <div className="flex items-center justify-between gap-3">
            <p className="text-lg font-semibold text-secondary-300 font-mono">{formatBRL(suggestedValue)}</p>
            <button
              type="button"
              onClick={() => setForm({ ...form, envelope_ajustado: fmtCurrency(Math.round(suggestedValue * 100).toString()) })}
              className="text-xs text-secondary-400 hover:text-secondary-300 underline transition-colors"
            >
              Usar este valor
            </button>
          </div>
        </div>
      )}

      {/* Envelope ajustado */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">
          Envelope mensal confirmado{' '}
          <span className="text-gray-500 font-normal text-xs">(valor que o cliente vai reservar)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          value={form.envelope_ajustado}
          onChange={(e) => setForm({ ...form, envelope_ajustado: fmtCurrency(e.target.value) })}
          placeholder="R$ 0,00"
          className="w-full px-3 py-2.5 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm font-mono transition-all"
        />
        <p className="text-xs text-gray-500">Este é o valor que aparece no app do cliente como "Reserve R$ X — Quitação {form.credor || '…'}".</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 rounded-lg border border-dark-600 text-gray-500 hover:text-gray-300 text-sm transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(form)}
          disabled={!isValid || saving}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-40 text-white text-sm font-medium transition-all"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Salvar
        </button>
      </div>
    </div>
  )
}

// ── Debt card ─────────────────────────────────────────────────

function DebtCard({
  debt,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  debt: ConsultorDebt
  onEdit: () => void
  onDelete: () => void
  onStatusChange: (s: ConsultorDebt['status']) => void
}) {
  const envelope = debt.envelope_ajustado ?? debt.envelope_mensal_sugerido

  return (
    <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
            <CreditCard className="w-4 h-4 text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-100">{debt.credor}</p>
            <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full border', statusColor(debt.status))}>
              {statusLabel(debt.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-600 hover:text-gray-300 hover:bg-dark-700/50 transition-all"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/5 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Numbers */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500 mb-0.5">Saldo devedor</p>
          <p className="font-semibold font-mono text-red-400">{formatBRL(debt.saldo_devedor)}</p>
        </div>
        {debt.valor_parcela && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Parcela</p>
            <p className="font-semibold font-mono text-amber-400">{formatBRL(debt.valor_parcela)}</p>
          </div>
        )}
        {debt.parcelas_restantes && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Parcelas restantes</p>
            <p className="font-semibold text-gray-300">{debt.parcelas_restantes}x</p>
          </div>
        )}
        {debt.taxa_juros && (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Juros</p>
            <p className="font-semibold text-gray-300">
              {debt.taxa_juros}% {debt.taxa_juros_tipo === 'mensal' ? 'a.m.' : 'a.a.'}
            </p>
          </div>
        )}
      </div>

      {/* Envelope */}
      {envelope && envelope > 0 && (
        <div className="rounded-lg border border-secondary-500/20 bg-secondary-500/5 p-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-3.5 h-3.5 text-secondary-400 shrink-0" />
            <p className="text-xs text-secondary-400 font-medium">
              Reserve{' '}
              <span className="text-secondary-300 font-mono font-semibold">{formatBRL(envelope)}</span>
              /mês — Quitação {debt.credor}
            </p>
          </div>
        </div>
      )}

      {/* Status change */}
      {debt.status === 'ativa' && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onStatusChange('quitada')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 hover:bg-emerald-500/10 transition-all"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Marcar quitada
          </button>
          <button
            onClick={() => onStatusChange('renegociada')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-amber-400 bg-amber-500/5 border border-amber-500/20 hover:bg-amber-500/10 transition-all"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Renegociada
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────

interface GestorDividasProps {
  familyId: string
}

export function GestorDividas({ familyId }: GestorDividasProps) {
  const [debts, setDebts] = useState<ConsultorDebt[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    consultorModuleService.getDebts(familyId).then(({ data }) => {
      setDebts(data ?? [])
      setLoading(false)
    })
  }, [familyId])

  const handleCreate = async (form: DebtFormData) => {
    setSaving(true)
    const input: CreateDebtInput = {
      family_id: familyId,
      credor: form.credor.trim(),
      saldo_devedor: parseBRL(form.saldo_devedor),
      taxa_juros: form.taxa_juros ? parseFloat(form.taxa_juros) : null,
      taxa_juros_tipo: form.taxa_juros_tipo,
      parcelas_restantes: form.parcelas_restantes ? parseInt(form.parcelas_restantes) : null,
      valor_parcela: form.valor_parcela ? parseBRL(form.valor_parcela) : null,
      data_vencimento: form.data_vencimento || null,
      envelope_ajustado: form.envelope_ajustado ? parseBRL(form.envelope_ajustado) : null,
    }

    const { data, error } = await consultorModuleService.createDebt(input)
    if (error) { toast.error('Erro ao salvar dívida'); setSaving(false); return }
    setDebts((prev) => [...prev, data!])
    setShowForm(false)
    toast.success('Dívida cadastrada')
    setSaving(false)
  }

  const handleUpdate = async (id: string, form: DebtFormData) => {
    setSaving(true)
    const updates = {
      credor: form.credor.trim(),
      saldo_devedor: parseBRL(form.saldo_devedor),
      taxa_juros: form.taxa_juros ? parseFloat(form.taxa_juros) : null,
      taxa_juros_tipo: form.taxa_juros_tipo,
      parcelas_restantes: form.parcelas_restantes ? parseInt(form.parcelas_restantes) : null,
      valor_parcela: form.valor_parcela ? parseBRL(form.valor_parcela) : null,
      data_vencimento: form.data_vencimento || null,
      envelope_ajustado: form.envelope_ajustado ? parseBRL(form.envelope_ajustado) : null,
    }
    const { data, error } = await consultorModuleService.updateDebt(id, updates)
    if (error) { toast.error('Erro ao atualizar dívida'); setSaving(false); return }
    setDebts((prev) => prev.map((d) => (d.id === id ? data! : d)))
    setEditingId(null)
    toast.success('Dívida atualizada')
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await consultorModuleService.deleteDebt(id)
    if (error) { toast.error('Erro ao remover dívida'); return }
    setDebts((prev) => prev.filter((d) => d.id !== id))
    toast.success('Dívida removida')
  }

  const handleStatusChange = async (id: string, status: ConsultorDebt['status']) => {
    const { data, error } = await consultorModuleService.updateDebt(id, { status })
    if (error) { toast.error('Erro ao atualizar status'); return }
    setDebts((prev) => prev.map((d) => (d.id === id ? data! : d)))
  }

  const activeDebts = debts.filter((d) => d.status === 'ativa')
  const inactiveDebts = debts.filter((d) => d.status !== 'ativa')
  const totalEnvelope = activeDebts.reduce((acc, d) => acc + (d.envelope_ajustado ?? d.envelope_mensal_sugerido ?? 0), 0)

  function debtToForm(d: ConsultorDebt): DebtFormData {
    return {
      credor: d.credor,
      saldo_devedor: d.saldo_devedor ? formatBRL(d.saldo_devedor) : '',
      taxa_juros: d.taxa_juros ? String(d.taxa_juros) : '',
      taxa_juros_tipo: d.taxa_juros_tipo,
      parcelas_restantes: d.parcelas_restantes ? String(d.parcelas_restantes) : '',
      valor_parcela: d.valor_parcela ? formatBRL(d.valor_parcela) : '',
      data_vencimento: d.data_vencimento ?? '',
      envelope_ajustado: d.envelope_ajustado ? formatBRL(d.envelope_ajustado) : '',
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-100">Gestão de Dívidas</h3>
          <p className="text-xs text-gray-500 mt-0.5">Passivos com ciclo de vida e envelopes de quitação</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Cadastrar dívida
          </button>
        )}
      </div>

      {/* Total envelope */}
      {totalEnvelope > 0 && (
        <div className="rounded-xl border border-secondary-500/20 bg-secondary-500/5 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total recomendado por mês (dívidas ativas)</p>
          <p className="text-2xl font-bold text-secondary-300 font-mono">{formatBRL(totalEnvelope)}</p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <DebtForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Active debts */}
      {activeDebts.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/20 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-dark-700/50 flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-sm text-gray-400 font-medium">Nenhuma dívida cadastrada</p>
          <p className="text-xs text-gray-600 mt-1">Cadastre os passivos do cliente para gerar envelopes de quitação.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activeDebts.map((d) =>
            editingId === d.id ? (
              <DebtForm
                key={d.id}
                initial={debtToForm(d)}
                onSave={(form) => handleUpdate(d.id, form)}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <DebtCard
                key={d.id}
                debt={d}
                onEdit={() => setEditingId(d.id)}
                onDelete={() => handleDelete(d.id)}
                onStatusChange={(s) => handleStatusChange(d.id, s)}
              />
            )
          )}
        </div>
      )}

      {/* Inactive debts */}
      {inactiveDebts.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Quitadas / Renegociadas</p>
          {inactiveDebts.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              onEdit={() => setEditingId(d.id)}
              onDelete={() => handleDelete(d.id)}
              onStatusChange={(s) => handleStatusChange(d.id, s)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
