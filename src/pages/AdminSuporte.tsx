import { useEffect, useState, useRef } from 'react'
import {
  Headphones, RefreshCw, Filter, ChevronDown, ChevronUp,
  Tag, StickyNote, User, Calendar, Crown, Clock, X, Plus,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { toast } from 'sonner'
import { format, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

// ─── Types ────────────────────────────────────────────────────────────────────

type TicketStatus = 'aberto' | 'em_andamento' | 'resolvido'
type TicketCategoria = 'Assinatura' | 'Problema Técnico' | 'Dúvidas' | 'Outro' | ''
type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente'

interface UserData {
  full_name: string
  email: string
  created_at: string
}

interface SubscriptionData {
  status: string
  tier: string
  trial_ends_at: string | null
  plan: string | null
}

interface Ticket {
  id: string
  nome: string
  email: string
  telefone: string | null
  categoria: string
  descricao: string
  status: TicketStatus
  origem: string
  prioridade: Prioridade
  tags: string[]
  admin_notes: string | null
  user_id: string | null
  created_at: string
  // enriched lazily
  _userData?: UserData | null
  _subscription?: SubscriptionData | null
  _userFetched?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PREDEFINED_TAGS = [
  'cobrança', 'reembolso', 'upgrade', 'bug', 'erro',
  'sugestão', 'feedback', 'urgente', 'aguardando-retorno',
]

const STATUS_LABELS: Record<TicketStatus, string> = {
  aberto: 'Aberto',
  em_andamento: 'Em andamento',
  resolvido: 'Resolvido',
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  aberto: 'bg-red-500/10 text-red-400 border-red-500/20',
  em_andamento: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  resolvido: 'bg-green-500/10 text-green-400 border-green-500/20',
}

const NEXT_STATUS: Record<TicketStatus, TicketStatus | null> = {
  aberto: 'em_andamento',
  em_andamento: 'resolvido',
  resolvido: null,
}

const NEXT_STATUS_LABEL: Record<TicketStatus, string> = {
  aberto: 'Marcar em andamento',
  em_andamento: 'Marcar resolvido',
  resolvido: '',
}

const PRIORIDADE_COLORS: Record<Prioridade, string> = {
  baixa: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  normal: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  alta: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  urgente: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const TIER_COLORS: Record<string, string> = {
  explorador: 'bg-gray-500/10 text-gray-400',
  planejador: 'bg-blue-500/10 text-blue-400',
  mestre: 'bg-purple-500/10 text-purple-400',
}

// ─── TicketCard ───────────────────────────────────────────────────────────────

function TicketCard({
  ticket,
  onUpdate,
}: {
  ticket: Ticket
  onUpdate: (id: string, patch: Partial<Ticket>) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [notesValue, setNotesValue] = useState(ticket.admin_notes ?? '')
  const [notesDirty, setNotesDirty] = useState(false)
  const [savingNotes, setSavingNotes] = useState(false)
  const [addingTag, setAddingTag] = useState(false)
  const [customTag, setCustomTag] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  // Fetch user data lazily when expanded
  useEffect(() => {
    if (!expanded || ticket._userFetched || !ticket.user_id) return

    const fetchUser = async () => {
      if (!supabase) return
      const [{ data: u }, { data: s }] = await Promise.all([
        db.from('users').select('full_name, email, created_at').eq('id', ticket.user_id).single(),
        db.from('subscriptions')
          .select('status, tier, trial_ends_at, plan')
          .eq('user_id', ticket.user_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ])
      onUpdate(ticket.id, {
        _userData: u ?? null,
        _subscription: s ?? null,
        _userFetched: true,
      })
    }
    fetchUser()
  }, [expanded, ticket._userFetched, ticket.user_id, ticket.id, onUpdate])

  // Focus tag input when opened
  useEffect(() => {
    if (addingTag) tagInputRef.current?.focus()
  }, [addingTag])

  const handleStatusAdvance = async () => {
    const next = NEXT_STATUS[ticket.status]
    if (!next || !supabase) return
    setUpdatingStatus(true)
    try {
      const { error } = await db.from('support_tickets').update({ status: next }).eq('id', ticket.id)
      if (error) throw error
      onUpdate(ticket.id, { status: next })
      toast.success(`Chamado marcado como "${STATUS_LABELS[next]}"`)
    } catch {
      toast.error('Erro ao atualizar status.')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handlePrioridadeChange = async (p: Prioridade) => {
    if (!supabase) return
    onUpdate(ticket.id, { prioridade: p })
    try {
      const { error } = await db.from('support_tickets').update({ prioridade: p }).eq('id', ticket.id)
      if (error) throw error
    } catch {
      toast.error('Erro ao atualizar prioridade.')
    }
  }

  const handleToggleTag = async (tag: string) => {
    if (!supabase) return
    const newTags = ticket.tags.includes(tag)
      ? ticket.tags.filter(t => t !== tag)
      : [...ticket.tags, tag]
    onUpdate(ticket.id, { tags: newTags })
    try {
      const { error } = await db.from('support_tickets').update({ tags: newTags }).eq('id', ticket.id)
      if (error) throw error
    } catch {
      toast.error('Erro ao atualizar tags.')
    }
  }

  const handleAddCustomTag = async () => {
    const tag = customTag.trim().toLowerCase().replace(/\s+/g, '-')
    if (!tag || ticket.tags.includes(tag)) { setAddingTag(false); setCustomTag(''); return }
    await handleToggleTag(tag)
    setCustomTag('')
    setAddingTag(false)
  }

  const handleSaveNotes = async () => {
    if (!supabase) return
    setSavingNotes(true)
    try {
      const { error } = await db.from('support_tickets').update({ admin_notes: notesValue || null }).eq('id', ticket.id)
      if (error) throw error
      onUpdate(ticket.id, { admin_notes: notesValue || null })
      setNotesDirty(false)
      toast.success('Anotação salva.')
    } catch {
      toast.error('Erro ao salvar anotação.')
    } finally {
      setSavingNotes(false)
    }
  }

  const daysAsCustomer = ticket._userData?.created_at
    ? differenceInDays(new Date(), new Date(ticket._userData.created_at))
    : null

  const trialDaysLeft = ticket._subscription?.trial_ends_at
    ? differenceInDays(new Date(ticket._subscription.trial_ends_at), new Date())
    : null

  return (
    <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
      {/* ── Summary row ───────────────────────────────────────────── */}
      <div
        className="p-4 sm:p-5 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Top: name + badges */}
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-gray-100">{ticket.nome}</span>
            <span className="text-sm text-gray-400">{ticket.email}</span>
            {ticket.telefone && (
              <span className="text-sm text-gray-500">{ticket.telefone}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Prioridade */}
            {ticket.prioridade !== 'normal' && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${PRIORIDADE_COLORS[ticket.prioridade]} ${ticket.prioridade === 'urgente' ? 'animate-pulse' : ''}`}>
                {ticket.prioridade.charAt(0).toUpperCase() + ticket.prioridade.slice(1)}
              </span>
            )}
            {/* Origem */}
            <span className={`text-xs px-2 py-0.5 rounded-full border ${ticket.origem === 'landing' ? 'bg-gray-500/10 text-gray-400 border-gray-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
              {ticket.origem === 'landing' ? 'Landing · sem login' : 'Via app'}
            </span>
            {/* Status */}
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[ticket.status]}`}>
              {STATUS_LABELS[ticket.status]}
            </span>
            {/* Expand toggle */}
            <span className="text-gray-500">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-2">
          <span className="bg-dark-700 px-2 py-0.5 rounded">{ticket.categoria}</span>
          <span>{format(new Date(ticket.created_at), "dd 'de' MMM yyyy, HH:mm", { locale: ptBR })}</span>
          {ticket.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {ticket.tags.map(tag => (
                <span key={tag} className="bg-secondary-500/10 text-secondary-400 border border-secondary-500/20 px-1.5 py-0.5 rounded text-[10px]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Description preview */}
        <p className={`text-sm text-gray-300 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
          {ticket.descricao}
        </p>
      </div>

      {/* ── Expanded details ──────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-dark-600 p-4 sm:p-5 space-y-5" onClick={e => e.stopPropagation()}>

          {/* [A] Customer profile */}
          {ticket.user_id && (
            <div className="bg-dark-700/50 border border-dark-600 rounded-xl p-4">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Perfil do cliente
              </h4>
              {!ticket._userFetched ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Carregando...
                </div>
              ) : ticket._userData ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-100">{ticket._userData.full_name}</span>
                    {ticket._subscription?.tier && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TIER_COLORS[ticket._subscription.tier] ?? 'bg-gray-500/10 text-gray-400'}`}>
                        <Crown className="w-3 h-3 inline-block mr-1" />
                        {ticket._subscription.tier.charAt(0).toUpperCase() + ticket._subscription.tier.slice(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">{ticket._userData.email}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {daysAsCustomer !== null ? `${daysAsCustomer} dias como cliente` : '—'}
                    </span>
                    {ticket._subscription?.plan && (
                      <span className="flex items-center gap-1">
                        <Crown className="w-3.5 h-3.5" />
                        {ticket._subscription.plan === 'annual' ? 'Plano anual' : 'Plano mensal'}
                      </span>
                    )}
                    {ticket._subscription?.status && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {ticket._subscription.status === 'trial'
                          ? trialDaysLeft !== null && trialDaysLeft >= 0
                            ? `Trial — ${trialDaysLeft} dias restantes`
                            : 'Trial expirado'
                          : ticket._subscription.status === 'active'
                            ? 'Assinatura ativa'
                            : ticket._subscription.status === 'canceled'
                              ? 'Assinatura cancelada'
                              : 'Expirado'}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Dados do usuário não encontrados.</p>
              )}
            </div>
          )}

          {/* [B] Tags + [C] Priority — side by side on sm+ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Tags */}
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5" /> Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {/* Active tags (removable) */}
                {ticket.tags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-secondary-500/15 text-secondary-400 border border-secondary-500/25 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
                  >
                    {tag} <X className="w-2.5 h-2.5" />
                  </button>
                ))}

                {/* Predefined suggestions (not yet added) */}
                {PREDEFINED_TAGS.filter(t => !ticket.tags.includes(t)).map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleToggleTag(tag)}
                    className="text-xs px-2 py-1 rounded-full bg-dark-700 text-gray-500 border border-dark-600 hover:bg-dark-600 hover:text-gray-300 transition-colors"
                  >
                    + {tag}
                  </button>
                ))}

                {/* Custom tag input */}
                {addingTag ? (
                  <div className="flex items-center gap-1">
                    <input
                      ref={tagInputRef}
                      value={customTag}
                      onChange={e => setCustomTag(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomTag() } if (e.key === 'Escape') { setAddingTag(false); setCustomTag('') } }}
                      placeholder="nova-tag"
                      className="text-xs px-2 py-1 rounded-full bg-dark-700 border border-primary-500/40 text-gray-100 placeholder-gray-600 outline-none w-24"
                    />
                    <button onClick={handleAddCustomTag} className="text-xs text-primary-400 hover:text-primary-300">OK</button>
                    <button onClick={() => { setAddingTag(false); setCustomTag('') }} className="text-xs text-gray-500 hover:text-gray-300"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingTag(true)}
                    className="text-xs px-2 py-1 rounded-full border border-dashed border-dark-500 text-gray-500 hover:text-gray-300 hover:border-dark-400 transition-colors flex items-center gap-0.5"
                  >
                    <Plus className="w-3 h-3" /> personalizada
                  </button>
                )}
              </div>
            </div>

            {/* Priority */}
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Prioridade
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {(['baixa', 'normal', 'alta', 'urgente'] as Prioridade[]).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePrioridadeChange(p)}
                    className={[
                      'text-xs px-3 py-1 rounded-full border transition-colors font-medium',
                      ticket.prioridade === p
                        ? PRIORIDADE_COLORS[p] + ' ring-1 ring-current'
                        : 'bg-dark-700 text-gray-500 border-dark-600 hover:bg-dark-600 hover:text-gray-300',
                    ].join(' ')}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* [D] Admin notes */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <StickyNote className="w-3.5 h-3.5" /> Anotações internas
            </h4>
            <textarea
              value={notesValue}
              onChange={e => { setNotesValue(e.target.value); setNotesDirty(true) }}
              placeholder="Anotações privadas sobre este chamado (não visíveis ao usuário)..."
              rows={3}
              className="w-full rounded-lg bg-dark-700 border border-dark-600 px-3 py-2.5 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-colors"
            />
            {notesDirty && (
              <div className="mt-2 flex justify-end">
                <Button size="sm" onClick={handleSaveNotes} isLoading={savingNotes} disabled={savingNotes}>
                  Salvar anotação
                </Button>
              </div>
            )}
          </div>

          {/* Status advance */}
          {NEXT_STATUS[ticket.status] && (
            <div className="pt-1 border-t border-dark-600">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleStatusAdvance}
                disabled={updatingStatus}
                isLoading={updatingStatus}
              >
                {NEXT_STATUS_LABEL[ticket.status]}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main AdminSuporte component ──────────────────────────────────────────────

export function AdminSuporte() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<TicketStatus | ''>('')
  const [filterCategoria, setFilterCategoria] = useState<TicketCategoria>('')

  const fetchTickets = async () => {
    setLoading(true)
    try {
      if (!supabase) throw new Error('Supabase não configurado')
      const { data, error } = await db
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      // Initialise fields that may be absent on older rows
      const rows = (data as Ticket[]).map(t => ({
        ...t,
        origem: t.origem ?? 'app',
        prioridade: (t.prioridade ?? 'normal') as Prioridade,
        tags: t.tags ?? [],
        admin_notes: t.admin_notes ?? null,
      }))
      setTickets(rows)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar chamados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTickets() }, [])

  const handleUpdate = (id: string, patch: Partial<Ticket>) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
  }

  const filtered = tickets.filter(t => {
    if (filterStatus && t.status !== filterStatus) return false
    if (filterCategoria && t.categoria !== filterCategoria) return false
    return true
  })

  const counts = {
    aberto: tickets.filter(t => t.status === 'aberto').length,
    em_andamento: tickets.filter(t => t.status === 'em_andamento').length,
    resolvido: tickets.filter(t => t.status === 'resolvido').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Chamados de Suporte</h1>
            <p className="text-sm text-gray-400">{tickets.length} chamados no total</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchTickets} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* Status counters */}
      <div className="grid grid-cols-3 gap-4">
        {(['aberto', 'em_andamento', 'resolvido'] as TicketStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(filterStatus === s ? '' : s)}
            className={[
              'rounded-xl border p-4 text-center transition-all cursor-pointer',
              filterStatus === s
                ? STATUS_COLORS[s] + ' ring-1 ring-current'
                : 'bg-dark-800 border-dark-600 hover:border-dark-500',
            ].join(' ')}
          >
            <div className="text-2xl font-bold text-gray-100">{counts[s]}</div>
            <div className={`text-xs font-medium mt-1 ${filterStatus === s ? '' : 'text-gray-400'}`}>
              {STATUS_LABELS[s]}
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <Select
          value={filterCategoria}
          onChange={e => setFilterCategoria(e.target.value as TicketCategoria)}
          className="w-48 text-sm"
        >
          <option value="">Todas as categorias</option>
          <option value="Assinatura">Assinatura</option>
          <option value="Problema Técnico">Problema Técnico</option>
          <option value="Dúvidas">Dúvidas</option>
          <option value="Outro">Outro</option>
        </Select>

        {(filterStatus || filterCategoria) && (
          <button
            onClick={() => { setFilterStatus(''); setFilterCategoria('') }}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors underline"
          >
            Limpar filtros
          </button>
        )}

        <span className="text-sm text-gray-400 ml-auto">
          {filtered.length} {filtered.length === 1 ? 'chamado' : 'chamados'}
        </span>
      </div>

      {/* Ticket list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 text-primary-400 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-dark-800 border border-dark-600 rounded-xl p-10 text-center text-gray-400">
          Nenhum chamado encontrado com os filtros selecionados.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ticket => (
            <TicketCard key={ticket.id} ticket={ticket} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}
