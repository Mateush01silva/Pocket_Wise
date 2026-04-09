import { useEffect, useState } from 'react'
import {
  Users, Search, RefreshCw, Crown, Clock, Calendar,
  ShieldOff, Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { toast } from 'sonner'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserRow {
  id: string
  full_name: string
  email: string
  created_at: string
}

interface PlanoRow {
  status: string
  tier: string
  plan_id: string | null
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  cancel_at_period_end: boolean
}

interface Stats {
  total: number
  trialsAtivos: number
  assinantesAtivos: number
  mestres: number
}

type PlanAction = 'mestre' | 'planejador' | 'trial' | 'bloquear'

const TIER_COLORS: Record<string, string> = {
  explorador: 'bg-gray-500/10 text-gray-300 border-gray-500/20',
  planejador: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  mestre: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
}

const TIER_LABELS: Record<string, string> = {
  explorador: 'Explorador',
  planejador: 'Planejador',
  mestre: 'Mestre',
}

const STATUS_COLORS: Record<string, string> = {
  trial: 'text-yellow-400',
  active: 'text-green-400',
  expired: 'text-red-400',
  canceled: 'text-gray-400',
}

const STATUS_LABELS: Record<string, string> = {
  trial: 'Trial',
  active: 'Ativo',
  expired: 'Expirado',
  canceled: 'Cancelado',
}

const ACTION_CONFIG: Record<PlanAction, { label: string; confirmLabel: string; color: string }> = {
  mestre: {
    label: 'Liberar Mestre',
    confirmLabel: 'Confirmar Mestre',
    color: 'bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20',
  },
  planejador: {
    label: 'Liberar Planejador',
    confirmLabel: 'Confirmar Planejador',
    color: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20',
  },
  trial: {
    label: 'Renovar Trial (14 dias)',
    confirmLabel: 'Confirmar Trial',
    color: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 hover:bg-yellow-500/20',
  },
  bloquear: {
    label: 'Bloquear acesso',
    confirmLabel: 'Confirmar Bloqueio',
    color: 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function planPayload(action: PlanAction) {
  const now = new Date()
  const farFuture = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate()).toISOString()
  const trialEnd = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  switch (action) {
    case 'mestre':
      return { status: 'active', tier: 'mestre', plan_id: 'mestre_manual', current_period_start: now.toISOString(), current_period_end: farFuture, cancel_at_period_end: false, trial_ends_at: null }
    case 'planejador':
      return { status: 'active', tier: 'planejador', plan_id: 'planejador_manual', current_period_start: now.toISOString(), current_period_end: farFuture, cancel_at_period_end: false, trial_ends_at: null }
    case 'trial':
      return { status: 'trial', tier: 'explorador', plan_id: null, trial_ends_at: trialEnd, current_period_start: null, current_period_end: null, cancel_at_period_end: false }
    case 'bloquear':
      return { status: 'expired', current_period_end: now.toISOString(), cancel_at_period_end: false }
  }
}

function statusDescription(plano: PlanoRow): string {
  if (plano.status === 'trial') {
    if (!plano.trial_ends_at) return 'Trial'
    const days = differenceInDays(new Date(plano.trial_ends_at), new Date())
    return days >= 0 ? `Trial — ${days} dias restantes` : 'Trial expirado'
  }
  if (plano.status === 'active') {
    if (plano.cancel_at_period_end && plano.current_period_end) {
      const days = differenceInDays(new Date(plano.current_period_end), new Date())
      return `Ativo — cancela em ${days} dias`
    }
    return `Ativo (${TIER_LABELS[plano.tier] ?? plano.tier})`
  }
  return STATUS_LABELS[plano.status] ?? plano.status
}

// ─── StatsCards ───────────────────────────────────────────────────────────────

function StatsCards({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  const cards = [
    { label: 'Total de usuários', value: stats?.total ?? 0, icon: <Users className="w-5 h-5 text-primary-400" />, color: 'text-primary-400' },
    { label: 'Trials ativos', value: stats?.trialsAtivos ?? 0, icon: <Clock className="w-5 h-5 text-yellow-400" />, color: 'text-yellow-400' },
    { label: 'Assinantes ativos', value: stats?.assinantesAtivos ?? 0, icon: <Crown className="w-5 h-5 text-green-400" />, color: 'text-green-400' },
    { label: 'Usuários Mestre', value: stats?.mestres ?? 0, icon: <Crown className="w-5 h-5 text-purple-400" />, color: 'text-purple-400' },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="bg-dark-800 border border-dark-600 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">{c.icon}<span className="text-xs text-gray-400">{c.label}</span></div>
          {loading ? (
            <div className="h-7 w-12 bg-dark-700 rounded animate-pulse" />
          ) : (
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── UserCard ────────────────────────────────────────────────────────────────

function UserCard({ user, onActionDone }: { user: UserRow; onActionDone: () => void }) {
  const [plano, setPlano] = useState<PlanoRow | null>(null)
  const [loadingPlano, setLoadingPlano] = useState(true)
  const [pendingAction, setPendingAction] = useState<PlanAction | null>(null)
  const [applying, setApplying] = useState(false)

  const fetchPlano = async () => {
    if (!supabase) return
    setLoadingPlano(true)
    const { data } = await db.from('plano_usuario')
      .select('status, tier, plan_id, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end')
      .eq('user_id', user.id)
      .single()
    setPlano(data ?? null)
    setLoadingPlano(false)
  }

  useEffect(() => { fetchPlano() }, [user.id])

  const handleApply = async () => {
    if (!pendingAction || !supabase) return
    setApplying(true)
    try {
      const payload = planPayload(pendingAction)
      const { error } = await db.from('plano_usuario').update(payload).eq('user_id', user.id)
      if (error) throw error
      toast.success(`Plano atualizado: ${ACTION_CONFIG[pendingAction].label}`)
      setPendingAction(null)
      await fetchPlano()
      onActionDone()
    } catch {
      toast.error('Erro ao atualizar plano.')
    } finally {
      setApplying(false)
    }
  }

  const daysAsCustomer = differenceInDays(new Date(), new Date(user.created_at))

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 space-y-4">
      {/* User info */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-100">{user.full_name}</span>
            {plano && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TIER_COLORS[plano.tier] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
                {TIER_LABELS[plano.tier] ?? plano.tier}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {daysAsCustomer} dias como cliente
          </span>
          <span className="text-gray-600">desde {format(new Date(user.created_at), "MMM yyyy", { locale: ptBR })}</span>
        </div>
      </div>

      {/* Plan status */}
      {loadingPlano ? (
        <div className="h-5 w-40 bg-dark-700 rounded animate-pulse" />
      ) : plano ? (
        <p className={`text-sm font-medium ${STATUS_COLORS[plano.status] ?? 'text-gray-400'}`}>
          {statusDescription(plano)}
        </p>
      ) : (
        <p className="text-sm text-gray-500">Sem registro de plano</p>
      )}

      {/* Actions */}
      <div className="pt-1 border-t border-dark-600">
        {pendingAction ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-300">
              {ACTION_CONFIG[pendingAction].confirmLabel} para{' '}
              <strong className="text-gray-100">{user.email}</strong>?
            </span>
            <Button size="sm" onClick={handleApply} isLoading={applying} disabled={applying}>
              Confirmar
            </Button>
            <button
              onClick={() => setPendingAction(null)}
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACTION_CONFIG) as PlanAction[]).map(action => (
              <button
                key={action}
                onClick={() => setPendingAction(action)}
                className={`text-xs px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 ${ACTION_CONFIG[action].color}`}
              >
                {action === 'bloquear' ? <ShieldOff className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
                {ACTION_CONFIG[action].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminUsuarios() {
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<UserRow[]>([])
  const [searching, setSearching] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  const fetchStats = async () => {
    if (!supabase) return
    setLoadingStats(true)
    try {
      const [{ count: total }, { data: planos }] = await Promise.all([
        db.from('users').select('id', { count: 'exact', head: true }),
        db.from('plano_usuario').select('status, tier, trial_ends_at'),
      ])

      const now = new Date()
      const trialsAtivos = (planos ?? []).filter(
        (p: PlanoRow) => p.status === 'trial' && p.trial_ends_at && new Date(p.trial_ends_at) > now
      ).length
      const assinantesAtivos = (planos ?? []).filter((p: PlanoRow) => p.status === 'active').length
      const mestres = (planos ?? []).filter(
        (p: PlanoRow) => p.tier === 'mestre' && p.status === 'active'
      ).length

      setStats({ total: total ?? 0, trialsAtivos, assinantesAtivos, mestres })
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingStats(false)
    }
  }

  useEffect(() => { fetchStats() }, [])

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!search.trim() || !supabase) return
    setSearching(true)
    setSearchResults([])
    try {
      const { data, error } = await db
        .from('users')
        .select('id, full_name, email, created_at')
        .ilike('email', `%${search.trim()}%`)
        .limit(10)
      if (error) throw error
      setSearchResults(data ?? [])
      if (!data?.length) toast('Nenhum usuário encontrado.')
    } catch {
      toast.error('Erro ao buscar usuários.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Gerenciar Usuários</h1>
            <p className="text-sm text-gray-400">Gerencie planos e acessos diretamente</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchStats} disabled={loadingStats}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loadingStats ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Stats */}
      <StatsCards stats={stats} loading={loadingStats} />

      {/* Search */}
      <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Buscar usuário por e-mail</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <Input
              placeholder="nome@email.com"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button type="submit" disabled={searching || !search.trim()} isLoading={searching}>
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Buscar'}
          </Button>
        </form>
      </div>

      {/* Results */}
      {searchResults.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">
            {searchResults.length} resultado{searchResults.length !== 1 ? 's' : ''}
          </p>
          {searchResults.map(user => (
            <UserCard key={user.id} user={user} onActionDone={fetchStats} />
          ))}
        </div>
      )}
    </div>
  )
}
