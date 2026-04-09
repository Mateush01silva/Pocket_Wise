import { useEffect, useState } from 'react'
import { Headphones, RefreshCw, Filter } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Untyped alias for tables not yet in Database type definition
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

type TicketStatus = 'aberto' | 'em_andamento' | 'resolvido'
type TicketCategoria = 'Assinatura' | 'Problema Técnico' | 'Dúvidas' | 'Outro' | ''

interface Ticket {
  id: string
  nome: string
  email: string
  telefone: string | null
  categoria: string
  descricao: string
  status: TicketStatus
  created_at: string
}

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

export function AdminSuporte() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
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
      setTickets(data as Ticket[])
    } catch (err) {
      console.error(err)
      toast.error('Erro ao carregar chamados.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTickets()
  }, [])

  const handleUpdateStatus = async (ticket: Ticket) => {
    const next = NEXT_STATUS[ticket.status]
    if (!next) return
    setUpdatingId(ticket.id)
    try {
      if (!supabase) throw new Error('Supabase não configurado')
      const { error } = await db
        .from('support_tickets')
        .update({ status: next })
        .eq('id', ticket.id)
      if (error) throw error
      setTickets((prev) =>
        prev.map((t) => (t.id === ticket.id ? { ...t, status: next } : t))
      )
      toast.success(`Chamado marcado como "${STATUS_LABELS[next]}"`)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao atualizar status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const filtered = tickets.filter((t) => {
    if (filterStatus && t.status !== filterStatus) return false
    if (filterCategoria && t.categoria !== filterCategoria) return false
    return true
  })

  const counts = {
    aberto: tickets.filter((t) => t.status === 'aberto').length,
    em_andamento: tickets.filter((t) => t.status === 'em_andamento').length,
    resolvido: tickets.filter((t) => t.status === 'resolvido').length,
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
        {(['aberto', 'em_andamento', 'resolvido'] as TicketStatus[]).map((s) => (
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
          onChange={(e) => setFilterCategoria(e.target.value as TicketCategoria)}
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

      {/* Table */}
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
          {filtered.map((ticket) => (
            <div
              key={ticket.id}
              className="bg-dark-800 border border-dark-600 rounded-xl p-4 sm:p-5 space-y-3"
            >
              {/* Top row */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-semibold text-gray-100">{ticket.nome}</span>
                  <span className="mx-2 text-gray-600">·</span>
                  <span className="text-sm text-gray-400">{ticket.email}</span>
                  {ticket.telefone && (
                    <>
                      <span className="mx-2 text-gray-600">·</span>
                      <span className="text-sm text-gray-400">{ticket.telefone}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${STATUS_COLORS[ticket.status]}`}>
                    {STATUS_LABELS[ticket.status]}
                  </span>
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="bg-dark-700 px-2 py-0.5 rounded">{ticket.categoria}</span>
                <span>
                  {format(new Date(ticket.created_at), "dd 'de' MMM yyyy, HH:mm", { locale: ptBR })}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-gray-300 leading-relaxed line-clamp-3">
                {ticket.descricao}
              </p>

              {/* Action */}
              {NEXT_STATUS[ticket.status] && (
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleUpdateStatus(ticket)}
                    disabled={updatingId === ticket.id}
                    isLoading={updatingId === ticket.id}
                  >
                    {NEXT_STATUS_LABEL[ticket.status]}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
