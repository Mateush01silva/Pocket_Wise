import { useState, useEffect } from 'react'
import { Plus, Edit3, Trash2, Check, Loader2, FileText, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'
import {
  consultorModuleService,
  type ConsultorSessionNote,
  type CreateSessionNoteInput,
} from '../../services/consultorModuleService'
import { cn } from '../../lib/cn'

function formatDate(d: string) {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })
}

// ── Note form ─────────────────────────────────────────────────

interface NoteFormData {
  session_date: string
  content: string
  next_steps: string
}

function NoteForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: NoteFormData
  onSave: (d: NoteFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState<NoteFormData>(
    initial ?? { session_date: today, content: '', next_steps: '' }
  )

  const isValid = form.content.trim().length >= 10

  return (
    <div className="rounded-xl border border-primary-500/20 bg-primary-500/5 p-5 space-y-4">
      <p className="text-xs font-medium text-primary-400 uppercase tracking-wider">
        {initial ? 'Editar nota' : 'Nova sessão'}
      </p>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">Data da sessão</label>
        <input
          type="date"
          value={form.session_date}
          onChange={(e) => setForm({ ...form, session_date: e.target.value })}
          className="w-full px-3 py-2.5 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 focus:outline-none focus:border-primary-500/60 text-sm transition-all"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">Observações e decisões *</label>
        <textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder="O que foi discutido, decisões tomadas, situação do cliente…"
          rows={5}
          className="w-full px-3 py-2.5 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm resize-none transition-all"
        />
        <p className="text-xs text-gray-600">Mínimo 10 caracteres. Estas notas são privadas — o cliente não as vê.</p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-300">Próximos passos <span className="text-gray-500 font-normal">(opcional)</span></label>
        <textarea
          value={form.next_steps}
          onChange={(e) => setForm({ ...form, next_steps: e.target.value })}
          placeholder="Ações definidas para o cliente até a próxima sessão…"
          rows={3}
          className="w-full px-3 py-2.5 rounded-lg bg-dark-800/60 border border-dark-600 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-primary-500/60 text-sm resize-none transition-all"
        />
      </div>

      <div className="flex gap-2">
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

// ── Note card ─────────────────────────────────────────────────

function NoteCard({
  note,
  onEdit,
  onDelete,
}: {
  note: ConsultorSessionNote
  onEdit: () => void
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isLong = note.content.length > 200

  return (
    <div className="rounded-xl border border-dark-700/40 bg-dark-800/30 p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-3.5 h-3.5 text-primary-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-200">{formatDate(note.session_date)}</p>
            <p className="text-xs text-gray-600">
              Criada em {new Date(note.created_at).toLocaleDateString('pt-BR')}
            </p>
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

      {/* Content */}
      <div>
        <p className={cn('text-sm text-gray-300 whitespace-pre-wrap leading-relaxed', !expanded && isLong && 'line-clamp-4')}>
          {note.content}
        </p>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Ver menos' : 'Ver mais'}
          </button>
        )}
      </div>

      {/* Next steps */}
      {note.next_steps && (
        <div className="rounded-lg border border-secondary-500/20 bg-secondary-500/5 p-3">
          <p className="text-xs font-medium text-secondary-400 mb-1.5">Próximos passos</p>
          <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{note.next_steps}</p>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────

interface HistoricoSessoesProps {
  familyId: string
}

export function HistoricoSessoes({ familyId }: HistoricoSessoesProps) {
  const { user } = useAuth()
  const [notes, setNotes] = useState<ConsultorSessionNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    consultorModuleService.getSessionNotes(familyId).then(({ data }) => {
      setNotes(data ?? [])
      setLoading(false)
    })
  }, [familyId])

  const handleCreate = async (form: { session_date: string; content: string; next_steps: string }) => {
    if (!user) return
    setSaving(true)
    const input: CreateSessionNoteInput = {
      family_id: familyId,
      session_date: form.session_date,
      content: form.content,
      next_steps: form.next_steps || null,
    }
    const { data, error } = await consultorModuleService.createSessionNote(input, user.id)
    if (error) { toast.error('Erro ao salvar nota'); setSaving(false); return }
    setNotes((prev) => [data!, ...prev])
    setShowForm(false)
    toast.success('Nota de sessão registrada')
    setSaving(false)
  }

  const handleUpdate = async (id: string, form: { session_date: string; content: string; next_steps: string }) => {
    setSaving(true)
    const { data, error } = await consultorModuleService.updateSessionNote(id, {
      session_date: form.session_date,
      content: form.content,
      next_steps: form.next_steps || null,
    })
    if (error) { toast.error('Erro ao atualizar nota'); setSaving(false); return }
    setNotes((prev) => prev.map((n) => (n.id === id ? data! : n)))
    setEditingId(null)
    toast.success('Nota atualizada')
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await consultorModuleService.deleteSessionNote(id)
    if (error) { toast.error('Erro ao remover nota'); return }
    setNotes((prev) => prev.filter((n) => n.id !== id))
    toast.success('Nota removida')
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
          <h3 className="font-semibold text-gray-100">Histórico de Sessões</h3>
          <p className="text-xs text-gray-500 mt-0.5">Notas privadas — não aparecem para o cliente</p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nova sessão
          </button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <NoteForm
          onSave={handleCreate}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      )}

      {/* Notes */}
      {notes.length === 0 && !showForm ? (
        <div className="rounded-xl border border-dark-700/50 bg-dark-800/20 p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-dark-700/50 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-5 h-5 text-gray-600" />
          </div>
          <p className="text-sm text-gray-400 font-medium">Nenhuma nota ainda</p>
          <p className="text-xs text-gray-600 mt-1">Registre o que foi discutido em cada sessão de consultoria.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) =>
            editingId === note.id ? (
              <NoteForm
                key={note.id}
                initial={{
                  session_date: note.session_date,
                  content: note.content,
                  next_steps: note.next_steps ?? '',
                }}
                onSave={(form) => handleUpdate(note.id, form)}
                onCancel={() => setEditingId(null)}
                saving={saving}
              />
            ) : (
              <NoteCard
                key={note.id}
                note={note}
                onEdit={() => setEditingId(note.id)}
                onDelete={() => handleDelete(note.id)}
              />
            )
          )}
        </div>
      )}
    </div>
  )
}
