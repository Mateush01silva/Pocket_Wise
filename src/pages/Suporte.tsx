import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Headphones, ArrowLeft, CheckCircle, DollarSign, Loader2, Lock, UserCircle } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { toast } from 'sonner'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any

const CATEGORIAS = ['Assinatura', 'Problema Técnico', 'Dúvidas', 'Outro'] as const

function formatTelefone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function Suporte() {
  const navigate = useNavigate()
  const { user, userProfile } = useAuth()

  const isLoggedIn = !!user && !!userProfile
  const [overrideIdentity, setOverrideIdentity] = useState(false)
  const identityLocked = isLoggedIn && !overrideIdentity

  const [form, setForm] = useState({
    nome: '',
    email: '',
    telefone: '',
    categoria: '',
    descricao: '',
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Pre-fill from profile when logged in
  useEffect(() => {
    if (isLoggedIn && !overrideIdentity) {
      setForm(prev => ({
        ...prev,
        nome: userProfile.full_name ?? '',
        email: userProfile.email ?? '',
      }))
    }
  }, [isLoggedIn, overrideIdentity, userProfile?.full_name, userProfile?.email])

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.nome.trim()) e.nome = 'Nome é obrigatório'
    if (!form.email.trim()) e.email = 'E-mail é obrigatório'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'E-mail inválido'
    if (!form.categoria) e.categoria = 'Selecione uma categoria'
    if (!form.descricao.trim()) e.descricao = 'Descrição é obrigatória'
    else if (form.descricao.trim().length < 20) e.descricao = 'Descreva melhor o problema (mín. 20 caracteres)'
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    setErrors({})
    setLoading(true)
    try {
      if (!supabase) throw new Error('Supabase não configurado')

      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        telefone: form.telefone.trim() || null,
        categoria: form.categoria,
        descricao: form.descricao.trim(),
        status: 'aberto',
        origem: isLoggedIn ? 'app' : 'landing',
        user_id: user?.id ?? null,
      }

      const { error } = await db.from('support_tickets').insert(payload)
      if (error) throw error
      setSuccess(true)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao enviar chamado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-dark-900 via-dark-800 to-dark-900">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-dark-900/80 backdrop-blur-lg border-b border-dark-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img
              src="/Logo_PocketWise.jpeg"
              alt="PocketWise"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <span className="text-xl font-bold text-gray-100">
              Pocket<span className="text-primary-500">Wise</span>
            </span>
          </button>

          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="pt-24 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          {/* Title */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-500/10 mb-4">
              <Headphones className="w-7 h-7 text-primary-400" />
            </div>
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Central de Suporte</h1>
            <p className="text-gray-400">
              Está com alguma dúvida ou problema? Preencha o formulário e nossa equipe entrará em contato.
            </p>
          </div>

          {success ? (
            /* Success state */
            <div className="bg-dark-800 border border-dark-600 rounded-2xl p-10 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/10 mb-4">
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
              <h2 className="text-2xl font-semibold text-gray-100 mb-2">Chamado enviado!</h2>
              <p className="text-gray-400 mb-6">
                Recebemos sua mensagem e entraremos em contato pelo e-mail{' '}
                <strong className="text-gray-200">{form.email}</strong> em breve.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="secondary" onClick={() => navigate('/')}>
                  Ir para a página inicial
                </Button>
                {user && (
                  <Button onClick={() => navigate('/app')}>
                    Voltar para o app
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-dark-800 border border-dark-600 rounded-2xl p-6 sm:p-8 space-y-5"
            >
              {/* Identity banner when logged in */}
              {identityLocked && (
                <div className="flex items-center gap-3 bg-primary-500/10 border border-primary-500/20 rounded-lg px-4 py-3">
                  <UserCircle className="w-4 h-4 text-primary-400 shrink-0" />
                  <p className="text-sm text-gray-300 flex-1">
                    Enviando como{' '}
                    <strong className="text-gray-100">{userProfile.email}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideIdentity(true)
                      setForm(prev => ({ ...prev, nome: '', email: '' }))
                    }}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors shrink-0 underline"
                  >
                    Usar outro e-mail
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Nome completo <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      placeholder="Seu nome completo"
                      value={form.nome}
                      onChange={(e) => setForm({ ...form, nome: e.target.value })}
                      disabled={identityLocked}
                      className={[
                        errors.nome ? 'border-red-500' : '',
                        identityLocked ? 'opacity-60 cursor-not-allowed pr-9' : '',
                      ].join(' ')}
                    />
                    {identityLocked && (
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                    )}
                  </div>
                  {errors.nome && <p className="mt-1 text-xs text-red-400">{errors.nome}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    E-mail <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="seu@email.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      disabled={identityLocked}
                      className={[
                        errors.email ? 'border-red-500' : '',
                        identityLocked ? 'opacity-60 cursor-not-allowed pr-9' : '',
                      ].join(' ')}
                    />
                    {identityLocked && (
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                    )}
                  </div>
                  {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Telefone / WhatsApp
                  </label>
                  <Input
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={form.telefone}
                    onChange={(e) => setForm({ ...form, telefone: formatTelefone(e.target.value) })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Categoria <span className="text-red-400">*</span>
                  </label>
                  <Select
                    value={form.categoria}
                    onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                    className={errors.categoria ? 'border-red-500' : ''}
                  >
                    <option value="">Selecione uma categoria</option>
                    {CATEGORIAS.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </Select>
                  {errors.categoria && <p className="mt-1 text-xs text-red-400">{errors.categoria}</p>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Descrição do problema <span className="text-red-400">*</span>
                </label>
                <textarea
                  placeholder="Descreva detalhadamente sua dúvida ou problema..."
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  maxLength={2000}
                  rows={5}
                  className={[
                    'w-full rounded-lg bg-dark-700 border px-3 py-2.5 text-sm text-gray-100 placeholder-gray-500 resize-none',
                    'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors',
                    errors.descricao ? 'border-red-500' : 'border-dark-600',
                  ].join(' ')}
                />
                <div className="flex items-start justify-between mt-1">
                  <span className="text-xs text-red-400">{errors.descricao || ''}</span>
                  <span className="text-xs text-gray-500 ml-auto">{form.descricao.length}/2000</span>
                </div>
              </div>

              <Button type="submit" className="w-full" isLoading={loading} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar chamado'
                )}
              </Button>
            </form>
          )}

          {/* Footer note */}
          <p className="text-center text-xs text-gray-500 mt-6 flex items-center justify-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            PocketWise — Gestão Financeira Inteligente
          </p>
        </div>
      </main>
    </div>
  )
}
