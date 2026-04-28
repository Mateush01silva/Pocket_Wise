import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  Users,
  ArrowRight,
  Briefcase,
  Eye,
  Home,
  ChevronRight,
  Loader2,
  Trophy,
  Lock,
  Clock,
  AlertTriangle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
import { useFamilyStore } from '../store/useFamilyStore'
import { useConsultorPermissions } from '../hooks/useConsultorPermissions'
import {
  useConsultorClientsData,
  sortClients,
  type ClientEnrichedData,
  type SortOrder,
} from '../hooks/useConsultorClientsData'
import { toast } from 'sonner'
import { cn } from '../lib/cn'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return 'Nenhuma movimentação registrada'

  const date = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Última atividade hoje'
  if (diffDays === 1) return 'Última atividade ontem'
  if (diffDays < 30) return `Última atividade há ${diffDays} dias`
  return 'Sem atividade nos últimos 30 dias'
}

function planLabel(tier: ClientEnrichedData['plan_tier']): string {
  if (tier === 'mestre') return 'Mestre'
  if (tier === 'planejador') return 'Planejador'
  return 'Explorador'
}

function planColorClass(tier: ClientEnrichedData['plan_tier']): string {
  if (tier === 'mestre') return 'text-secondary-400 bg-secondary-500/10 border-secondary-500/20'
  if (tier === 'planejador') return 'text-primary-400 bg-primary-500/10 border-primary-500/20'
  return 'text-gray-400 bg-dark-700/50 border-dark-600'
}

function pocksScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-amber-400'
  return 'text-red-400'
}

// ── Sub-components ─────────────────────────────────────────────────────────

function PlanBadge({ tier }: { tier: ClientEnrichedData['plan_tier'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border',
        planColorClass(tier)
      )}
    >
      {planLabel(tier)}
    </span>
  )
}

function PocksRow({ client }: { client: ClientEnrichedData }) {
  const { pocks_status, pocks_score } = client

  if (pocks_status === 'calculated' && pocks_score !== null) {
    return (
      <div className="flex items-center gap-2">
        <Trophy className={cn('w-3.5 h-3.5 shrink-0', pocksScoreColor(pocks_score))} />
        <span className={cn('text-xs font-semibold tabular-nums', pocksScoreColor(pocks_score))}>
          {pocks_score} pts
        </span>
        <span className="text-xs text-gray-600">Pocks</span>
      </div>
    )
  }

  if (pocks_status === 'pending') {
    return (
      <div className="flex items-center gap-2">
        <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
        <span className="text-xs text-gray-500">Score em cálculo</span>
      </div>
    )
  }

  // no_access
  return (
    <div className="flex items-center gap-2">
      <Lock className="w-3.5 h-3.5 text-gray-600 shrink-0" />
      <span className="text-xs text-gray-600">Disponível no Mestre</span>
    </div>
  )
}

function AlertBadge({ client }: { client: ClientEnrichedData }) {
  const { negative_envelopes_count, has_inactivity_alert } = client

  if (negative_envelopes_count > 0) {
    return (
      <div
        title={`${negative_envelopes_count} envelope${negative_envelopes_count > 1 ? 's' : ''} estourado${negative_envelopes_count > 1 ? 's' : ''}`}
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20"
      >
        <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
        <span className="text-[10px] font-semibold text-red-400">
          {negative_envelopes_count} {negative_envelopes_count > 1 ? 'estourados' : 'estourado'}
        </span>
      </div>
    )
  }

  if (has_inactivity_alert) {
    return (
      <div
        title="Sem movimentações nos últimos 7 dias"
        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20"
      >
        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="text-[10px] font-semibold text-amber-400">Inativo</span>
      </div>
    )
  }

  return null
}

// ── Sort selector ─────────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'alerta', label: 'Por alerta' },
  { value: 'pocks', label: 'Por Pocks' },
  { value: 'atividade', label: 'Por atividade' },
  { value: 'alfabetica', label: 'Alfabética' },
]

function SortSelector({
  value,
  onChange,
}: {
  value: SortOrder
  onChange: (v: SortOrder) => void
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
            value === opt.value
              ? 'bg-primary-500/10 border border-primary-500/20 text-primary-400'
              : 'bg-dark-800/50 border border-dark-700/50 text-gray-500 hover:text-gray-300 hover:border-dark-600'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ── Client card ────────────────────────────────────────────────────────────

function ClientCard({
  client,
  isLoading,
  onAccess,
}: {
  client: ClientEnrichedData
  isLoading: boolean
  onAccess: (id: string) => void
}) {
  return (
    <div className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-5 flex flex-col gap-4 hover:border-dark-600 transition-colors">
      {/* Header: nome + alerta */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
          <Users className="w-4 h-4 text-primary-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-gray-100 truncate">{client.nome}</p>
            <AlertBadge client={client} />
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Eye className="w-3 h-3 text-gray-500" />
              <span className="text-xs text-gray-500">Consultor</span>
            </div>
            <PlanBadge tier={client.plan_tier} />
          </div>
        </div>
      </div>

      {/* Pocks + última atividade */}
      <div className="flex flex-col gap-2 border-t border-dark-700/30 pt-3">
        <PocksRow client={client} />
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-gray-600 shrink-0" />
          <span className="text-xs text-gray-500">{formatRelativeDate(client.last_transaction_date)}</span>
        </div>
      </div>

      {/* Botão acessar */}
      <button
        onClick={() => onAccess(client.family_id)}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-all text-sm font-medium disabled:opacity-60"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Acessar
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </div>
  )
}

// ── Skeleton card (loading state) ─────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-5 flex flex-col gap-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-dark-700/50 shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-dark-700/50 rounded w-2/3" />
          <div className="h-3 bg-dark-700/30 rounded w-1/3" />
        </div>
      </div>
      <div className="border-t border-dark-700/30 pt-3 space-y-2">
        <div className="h-3 bg-dark-700/30 rounded w-1/2" />
        <div className="h-3 bg-dark-700/30 rounded w-3/4" />
      </div>
      <div className="h-9 bg-dark-700/30 rounded-lg" />
    </div>
  )
}

// ── Page component ─────────────────────────────────────────────────────────

export function ConsultorClientes() {
  const { userFamilies, switchFamily, personalFamilyId, isPersonalSubValid } = useAuth()
  const { isConsultor } = useConsultorPermissions()
  const family = useFamilyStore((state) => state.family)
  const [loadingFamilyId, setLoadingFamilyId] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('alerta')

  const { clients, isLoading: isLoadingClients, error, refresh } = useConsultorClientsData()

  const sortedClients = sortClients(clients, sortOrder)

  const hasClients =
    userFamilies.some((f) => f.member_type === 'consultor') || clients.length > 0

  const handleAccess = async (familyId: string) => {
    setLoadingFamilyId(familyId)
    const result = await switchFamily(familyId)
    if (result.success) {
      window.location.href = '/app'
    } else {
      toast.error(result.error ?? 'Erro ao acessar conta do cliente')
      setLoadingFamilyId(null)
    }
  }

  const handleBackToPersonal = async () => {
    const targetId =
      personalFamilyId ??
      userFamilies.find((f) => f.is_personal)?.family_id ??
      userFamilies.find((f) => f.member_type === 'familiar' && f.role === 'admin')?.family_id ??
      userFamilies.find((f) => f.role === 'admin')?.family_id
    if (!targetId) {
      toast.error('Não foi possível identificar sua conta pessoal')
      return
    }
    if (!isPersonalSubValid()) {
      window.location.href = '/app/assinar'
      return
    }
    setLoadingFamilyId('personal')
    const result = await switchFamily(targetId)
    if (result.success) {
      window.location.href = '/app'
    } else {
      toast.error(result.error ?? 'Erro ao voltar para conta pessoal')
      setLoadingFamilyId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-100">Meus Clientes</h1>
            <p className="text-sm text-gray-500">Famílias que você acompanha como consultor</p>
          </div>
        </div>
        {!isLoadingClients && clients.length > 0 && (
          <button
            onClick={refresh}
            title="Atualizar dados"
            className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-800 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Contexto atual (quando visualizando cliente) */}
      {isConsultor && (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Contexto atual</p>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Briefcase className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-100 truncate">{family?.nome || 'Cliente'}</p>
                <p className="text-xs text-gray-500">Você está visualizando como consultor</p>
              </div>
            </div>
            <button
              onClick={handleBackToPersonal}
              disabled={loadingFamilyId === 'personal'}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-700/50 border border-dark-600 text-gray-300 hover:bg-dark-700 hover:text-white transition-all text-sm font-medium shrink-0 disabled:opacity-60"
            >
              {loadingFamilyId === 'personal' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Home className="w-4 h-4" />
              )}
              Minha Conta
            </button>
          </div>
        </div>
      )}

      {/* Lista de clientes */}
      {!hasClients && !isLoadingClients ? (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-dark-700/50 flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-gray-500" />
          </div>
          <h3 className="text-base font-medium text-gray-300 mb-1">Nenhum cliente ainda</h3>
          <p className="text-sm text-gray-500">
            Quando um cliente te convidar como consultor, ele aparecerá aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Ordenação */}
          {(clients.length > 1 || isLoadingClients) && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs text-gray-500 uppercase tracking-wider shrink-0">Ordenar por</span>
              <SortSelector value={sortOrder} onChange={setSortOrder} />
            </div>
          )}

          {/* Erro de carregamento */}
          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-center gap-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <p className="text-xs text-gray-500 uppercase tracking-wider -mb-3">Clientes</p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {isLoadingClients
              ? Array.from({ length: Math.max(clients.length, 2) }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              : sortedClients.map((client) => (
                  <ClientCard
                    key={client.family_id}
                    client={client}
                    isLoading={loadingFamilyId === client.family_id}
                    onAccess={handleAccess}
                  />
                ))}
          </div>
        </>
      )}

      {/* Atalho para conta pessoal */}
      <div className="rounded-xl border border-dark-700/50 bg-dark-800/30 p-4">
        <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Minha conta</p>
        <button
          onClick={handleBackToPersonal}
          disabled={loadingFamilyId === 'personal'}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-dark-700/50 transition-colors text-left disabled:opacity-60"
        >
          <div className="w-9 h-9 rounded-lg bg-dark-700/50 border border-dark-600 flex items-center justify-center shrink-0">
            {loadingFamilyId === 'personal' ? (
              <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <Home className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-200">Voltar para minha conta</p>
            <p className="text-xs text-gray-500">Acessar suas finanças pessoais</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
        </button>
      </div>
    </div>
  )
}
