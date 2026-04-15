import { useEffect, useState } from 'react'
import {
  Users, Search, RefreshCw, Crown, Clock, Calendar,
  ShieldOff, Loader2, Mail,
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

type PlanAction = 'trial' | 'bloquear'

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
  trial: {
    label: 'Renovar Trial',
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

function planPayload(action: PlanAction, trialDias = 14) {
  const now = new Date()
  const trialEnd = new Date(Date.now() + trialDias * 24 * 60 * 60 * 1000).toISOString()

  switch (action) {
    case 'trial':
      return { status: 'trial', tier: 'explorador', plan_id: null, trial_ends_at: trialEnd, current_period_start: null, current_period_end: null, cancel_at_period_end: false }
    case 'bloquear':
      return { status: 'expired', current_period_end: now.toISOString(), cancel_at_period_end: false }
  }
}

function statusDescription(plano: PlanoRow): string {
  if (plano.status === 'trial') {
    if (!plano.trial_ends_at) return 'Trial'
    const end = new Date(plano.trial_ends_at)
    const days = differenceInDays(end, new Date())
    const fmt = format(end, "dd/MM/yyyy", { locale: ptBR })
    return days >= 0 ? `Trial até ${fmt} (${days} dias)` : 'Trial expirado'
  }
  if (plano.status === 'active') {
    const end = plano.current_period_end ? new Date(plano.current_period_end) : null
    const isVitalicio = end && differenceInDays(end, new Date()) > 365 * 10
    if (plano.cancel_at_period_end && end) {
      const days = differenceInDays(end, new Date())
      return `Ativo até ${format(end, "dd/MM/yyyy", { locale: ptBR })} (cancela em ${days} dias)`
    }
    if (isVitalicio) return `Vitalício — ${TIER_LABELS[plano.tier] ?? plano.tier}`
    if (end) {
      const days = differenceInDays(end, new Date())
      return `Ativo até ${format(end, "dd/MM/yyyy", { locale: ptBR })} (${days} dias)`
    }
    return `Ativo — ${TIER_LABELS[plano.tier] ?? plano.tier}`
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
  const [displayEmail, setDisplayEmail] = useState(user.email)
  const [editingEmail, setEditingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [applyingEmail, setApplyingEmail] = useState(false)
  const [trialDias, setTrialDias] = useState(14)
  const [liberarOpen, setLiberarOpen] = useState(false)
  const [liberarTier, setLiberarTier] = useState<'mestre' | 'planejador'>('mestre')
  const [liberarDias, setLiberarDias] = useState<number>(30)
  const [liberarVitalicio, setLiberarVitalicio] = useState(false)
  const [liberarCustom, setLiberarCustom] = useState(false)
  const [lancamentosCount, setLancamentosCount] = useState<number | null>(null)

  const fetchPlano = async () => {
    if (!supabase) return
    setLoadingPlano(true)
    try {
      const [{ data }, { count }] = await Promise.all([
        db.from('plano_usuario')
          .select('status, tier, plan_id, trial_ends_at, current_period_start, current_period_end, cancel_at_period_end')
          .eq('user_id', user.id)
          .single(),
        db.from('lancamentos')
          .select('id', { count: 'exact', head: true })
          .eq('criado_por', user.id),
      ])
      setPlano(data ?? null)
      setLancamentosCount(count ?? 0)
    } catch (err) {
      console.error('Erro ao buscar plano:', err)
    } finally {
      setLoadingPlano(false)
    }
  }

  useEffect(() => { fetchPlano() }, [user.id])

  const handleApply = async () => {
    if (!pendingAction || !supabase) return
    setApplying(true)
    try {
      const payload = planPayload(pendingAction, trialDias)
      const { error } = await db.from('plano_usuario').update(payload).eq('user_id', user.id)
      if (error) throw error
      const label = pendingAction === 'trial' ? `Trial por ${trialDias} dias` : ACTION_CONFIG[pendingAction].label
      toast.success(`Plano atualizado: ${label}`)
      setPendingAction(null)
      await fetchPlano()
      onActionDone()
    } catch {
      toast.error('Erro ao atualizar plano.')
    } finally {
      setApplying(false)
    }
  }

  const handleLiberarAcesso = async () => {
    if (!supabase) return
    setApplying(true)
    try {
      const now = new Date()
      const periodEnd = liberarVitalicio
        ? new Date(now.getFullYear() + 100, now.getMonth(), now.getDate()).toISOString()
        : new Date(Date.now() + liberarDias * 24 * 60 * 60 * 1000).toISOString()
      const payload = {
        status: 'active',
        tier: liberarTier,
        plan_id: null,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        trial_ends_at: null,
      }
      const { error } = await db.from('plano_usuario').update(payload).eq('user_id', user.id)
      if (error) throw error
      const label = liberarVitalicio ? 'Vitalício' : `${liberarDias} dias`
      toast.success(`Acesso ${TIER_LABELS[liberarTier]} liberado — ${label}`)
      setLiberarOpen(false)
      await fetchPlano()
      onActionDone()
    } catch {
      toast.error('Erro ao liberar acesso.')
    } finally {
      setApplying(false)
    }
  }

  const handleEmailUpdate = async () => {
    if (!supabase) return
    setApplyingEmail(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Sessão não encontrada')
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ targetUserId: user.id, newEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success('E-mail atualizado! Confirmação enviada ao novo endereço.')
      setDisplayEmail(newEmail)
      setEditingEmail(false)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      toast.error(`Erro: ${msg}`)
    } finally {
      setApplyingEmail(false)
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
          <p className="text-sm text-gray-400 mt-0.5">{displayEmail}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {daysAsCustomer} dias como cliente
          </span>
          <span className="text-gray-600">desde {format(new Date(user.created_at), "MMM yyyy", { locale: ptBR })}</span>
          {lancamentosCount !== null && (
            <span className="text-gray-600">{lancamentosCount} lançamentos</span>
          )}
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
      <div className="pt-1 border-t border-dark-600 space-y-2">
        {editingEmail ? (
          <div className="space-y-2">
            <span className="text-sm text-gray-300">Novo e-mail para <strong className="text-gray-100">{displayEmail}</strong>:</span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@email.com"
                className="flex-1 min-w-0 bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-primary-500"
              />
              <Button size="sm" onClick={handleEmailUpdate} isLoading={applyingEmail} disabled={applyingEmail || !newEmail.trim()}>
                Confirmar
              </Button>
              <button onClick={() => setEditingEmail(false)} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : liberarOpen ? (
          <div className="space-y-3">
            {/* Tier selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setLiberarTier('mestre')}
                className={`flex-1 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex items-center justify-center gap-1.5 ${liberarTier === 'mestre' ? 'bg-purple-500/20 text-purple-300 border-purple-500/40' : 'bg-dark-700 text-gray-400 border-dark-500 hover:bg-dark-600'}`}
              >
                <Crown className="w-3.5 h-3.5" /> Mestre
              </button>
              <button
                onClick={() => setLiberarTier('planejador')}
                className={`flex-1 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors flex items-center justify-center gap-1.5 ${liberarTier === 'planejador' ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' : 'bg-dark-700 text-gray-400 border-dark-500 hover:bg-dark-600'}`}
              >
                <Crown className="w-3.5 h-3.5" /> Planejador
              </button>
            </div>
            {/* Duration quick-select */}
            <div className="flex flex-wrap gap-1.5">
              {[7, 30, 90, 365].map(d => (
                <button
                  key={d}
                  onClick={() => { setLiberarDias(d); setLiberarVitalicio(false); setLiberarCustom(false) }}
                  className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${!liberarVitalicio && !liberarCustom && liberarDias === d ? 'bg-green-500/20 text-green-300 border-green-500/40' : 'bg-dark-700 text-gray-400 border-dark-500 hover:bg-dark-600'}`}
                >
                  {d} dias
                </button>
              ))}
              <button
                onClick={() => { setLiberarVitalicio(true); setLiberarCustom(false) }}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${liberarVitalicio ? 'bg-green-500/20 text-green-300 border-green-500/40' : 'bg-dark-700 text-gray-400 border-dark-500 hover:bg-dark-600'}`}
              >
                Vitalício
              </button>
              <button
                onClick={() => { setLiberarCustom(true); setLiberarVitalicio(false) }}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${liberarCustom ? 'bg-green-500/20 text-green-300 border-green-500/40' : 'bg-dark-700 text-gray-400 border-dark-500 hover:bg-dark-600'}`}
              >
                Outro
              </button>
            </div>
            {liberarCustom && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={3650}
                  value={liberarDias}
                  onChange={e => setLiberarDias(Math.max(1, Number(e.target.value)))}
                  className="w-20 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-sm text-gray-100 text-center focus:outline-none focus:border-primary-500"
                />
                <span className="text-sm text-gray-400">dias</span>
              </div>
            )}
            {/* Confirm row */}
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleLiberarAcesso} isLoading={applying} disabled={applying}>
                Confirmar
              </Button>
              <button onClick={() => setLiberarOpen(false)} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                Cancelar
              </button>
              <span className="text-xs text-gray-500 ml-1">
                → {TIER_LABELS[liberarTier]}, {liberarVitalicio ? 'vitalício' : `${liberarDias} dias`}
              </span>
            </div>
          </div>
        ) : pendingAction ? (
          <div className="flex flex-wrap items-center gap-2">
            {pendingAction === 'trial' ? (
              <>
                <span className="text-sm text-gray-300">Renovar Trial por</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={trialDias}
                  onChange={e => setTrialDias(Math.max(1, Number(e.target.value)))}
                  className="w-16 bg-dark-700 border border-dark-500 rounded-lg px-2 py-1 text-sm text-gray-100 text-center focus:outline-none focus:border-primary-500"
                />
                <span className="text-sm text-gray-300">dias para <strong className="text-gray-100">{displayEmail}</strong>?</span>
              </>
            ) : (
              <span className="text-sm text-gray-300">
                {ACTION_CONFIG[pendingAction].confirmLabel} para{' '}
                <strong className="text-gray-100">{displayEmail}</strong>?
              </span>
            )}
            <Button size="sm" onClick={handleApply} isLoading={applying} disabled={applying}>
              Confirmar
            </Button>
            <button onClick={() => setPendingAction(null)} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {/* Liberar Acesso */}
            <button
              onClick={() => { setLiberarOpen(true); setPendingAction(null); setEditingEmail(false) }}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20"
            >
              <Crown className="w-3.5 h-3.5" />
              Liberar Acesso
            </button>
            {/* Trial e Bloquear */}
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
            {/* Editar E-mail */}
            <button
              onClick={() => { setEditingEmail(true); setNewEmail(displayEmail) }}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 bg-gray-500/10 text-gray-400 border border-gray-500/20 hover:bg-gray-500/20"
            >
              <Mail className="w-3.5 h-3.5" />
              Editar E-mail
            </button>
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
      const term = search.trim()
      const { data, error } = await db
        .from('users')
        .select('id, full_name, email, created_at')
        .or(`email.ilike.%${term}%,full_name.ilike.%${term}%`)
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
        <h2 className="text-sm font-semibold text-gray-300">Buscar por nome ou e-mail</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <Input
              placeholder="Nome ou e-mail"
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
