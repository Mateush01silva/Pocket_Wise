import { useState, useEffect } from 'react'
import { Mail, Copy, Check, Info, UserPlus, Clock } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { useFamilyStore } from '../store/useFamilyStore'
import { toast } from 'sonner'

interface FamilyInviteModalProps {
  isOpen: boolean
  onClose: () => void
  familyId: string
}

export function FamilyInviteModal({ isOpen, onClose, familyId }: FamilyInviteModalProps) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'editor' | 'viewer'>('viewer')
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [createdInvite, setCreatedInvite] = useState<{
    token: string
    invited_email: string
  } | null>(null)
  const [copied, setCopied] = useState(false)

  const createInvite = useFamilyStore((state) => state.createInvite)
  const error = useFamilyStore((state) => state.error)

  // Reset ao abrir/fechar
  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setRole('viewer')
      setMessage('')
      setCreatedInvite(null)
      setCopied(false)
    }
  }, [isOpen])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validação básica de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Por favor, insira um email válido')
      return
    }

    setIsLoading(true)

    try {
      const invite = await createInvite({
        family_id: familyId,
        invited_email: email,
        role,
        message: message || undefined,
      })

      if (invite) {
        setCreatedInvite({
          token: invite.token,
          invited_email: invite.invited_email,
        })
        toast.success('Convite criado com sucesso!')
      } else {
        toast.error(error || 'Erro ao criar convite')
      }
    } catch (err) {
      console.error('Erro ao criar convite:', err)
      toast.error('Erro ao criar convite. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const getInviteLink = () => {
    if (!createdInvite) return ''
    const baseUrl = window.location.origin
    return `${baseUrl}/convite/${createdInvite.token}`
  }

  const handleCopyLink = async () => {
    const link = getInviteLink()
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Erro ao copiar:', err)
      toast.error('Erro ao copiar link')
    }
  }

  const handleClose = () => {
    setCreatedInvite(null)
    onClose()
  }

  // Se já criou o convite, mostrar a tela de sucesso
  if (createdInvite) {
    return (
      <Modal isOpen={isOpen} onClose={handleClose} title="Convite Criado!">
        <div className="space-y-6">
          {/* Success Message */}
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-green-300 mb-1">Convite criado com sucesso!</p>
                <p className="text-xs text-gray-400">
                  O link de convite foi gerado. Copie e compartilhe com{' '}
                  <span className="font-medium text-gray-300">{createdInvite.invited_email}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Link Box */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Link do Convite
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={getInviteLink()}
                readOnly
                className="flex-1 px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 text-sm font-mono"
              />
              <Button
                type="button"
                variant={copied ? 'secondary' : 'primary'}
                onClick={handleCopyLink}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copiado
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Instructions */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-blue-300 mb-2">Como usar o convite:</p>
                <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Copie o link acima</li>
                  <li>
                    Envie para {createdInvite.invited_email} pelo WhatsApp, email ou qualquer outro
                    meio
                  </li>
                  <li>A pessoa deve abrir o link, fazer login ou cadastro</li>
                  <li>
                    Após aceitar, ela se tornará membro da sua família com permissão de{' '}
                    <span className="font-medium">
                      {role === 'admin'
                        ? 'Administrador'
                        : role === 'editor'
                        ? 'Editor'
                        : 'Visualizador'}
                    </span>
                  </li>
                </ol>
              </div>
            </div>
          </div>

          {/* Expiration Notice */}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Este convite expira em 7 dias</span>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    )
  }

  // Formulário de criação de convite
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convidar Membro">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Info Box */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-blue-300 mb-1">Como funciona?</p>
              <p className="text-xs text-gray-400">
                Você irá gerar um link único de convite que pode ser compartilhado por WhatsApp,
                email ou qualquer outro meio. A pessoa convidada precisa usar o mesmo email
                informado aqui para aceitar o convite.
              </p>
            </div>
          </div>
        </div>

        {/* Email Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email da Pessoa <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@email.com"
              required
              className="w-full pl-10 pr-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">
            A pessoa precisa usar este email para aceitar o convite
          </p>
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Permissão <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 bg-dark-700/50 border border-dark-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
              <input
                type="radio"
                name="role"
                value="viewer"
                checked={role === 'viewer'}
                onChange={(e) => setRole(e.target.value as any)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-200">Visualizador</p>
                <p className="text-xs text-gray-400">
                  Pode ver todas as transações e relatórios, mas não pode criar ou editar
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-dark-700/50 border border-dark-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
              <input
                type="radio"
                name="role"
                value="editor"
                checked={role === 'editor'}
                onChange={(e) => setRole(e.target.value as any)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-200">Editor</p>
                <p className="text-xs text-gray-400">
                  Pode criar, editar e deletar transações, categorias e cartões
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 bg-dark-700/50 border border-dark-600 rounded-lg cursor-pointer hover:border-primary-500 transition-colors">
              <input
                type="radio"
                name="role"
                value="admin"
                checked={role === 'admin'}
                onChange={(e) => setRole(e.target.value as any)}
                className="mt-1"
              />
              <div className="flex-1">
                <p className="font-medium text-gray-200">Administrador</p>
                <p className="text-xs text-gray-400">
                  Controle total: pode gerenciar membros, convites e todas as funcionalidades
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Message (Optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Mensagem Personalizada (opcional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex: Olá! Gostaria de compartilhar minhas finanças com você..."
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors resize-none"
            rows={3}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading} disabled={!email} className="flex-1">
            <UserPlus className="w-4 h-4 mr-2" />
            Gerar Convite
          </Button>
        </div>
      </form>
    </Modal>
  )
}
