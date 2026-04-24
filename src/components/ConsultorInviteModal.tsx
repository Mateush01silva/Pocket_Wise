import { useState, useEffect } from 'react'
import { Mail, Copy, Check, Info, Briefcase, UserCheck, Settings, Clock } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { consultorService } from '../services/consultorService'
import { toast } from 'sonner'
import type { ConsultorProfile, ConsultorPermissionsInput } from '../types'

interface ConsultorInviteModalProps {
  isOpen: boolean
  onClose: () => void
  familyId: string
}

const PROFILE_PRESETS: Record<ConsultorProfile, ConsultorPermissionsInput & { profile_preset: ConsultorProfile }> = {
  configurador: {
    profile_preset: 'configurador',
    can_create_envelopes: true,
    can_create_categories: true,
    can_manage_accounts: true,
    can_view_envelopes: true,
    can_view_pocks: true,
    can_view_caixinhas: true,
  },
  acompanhador: {
    profile_preset: 'acompanhador',
    can_create_envelopes: false,
    can_create_categories: false,
    can_manage_accounts: false,
    can_view_envelopes: true,
    can_view_pocks: true,
    can_view_caixinhas: true,
  },
  custom: {
    profile_preset: 'custom',
    can_create_envelopes: false,
    can_create_categories: false,
    can_manage_accounts: false,
    can_view_envelopes: true,
    can_view_pocks: true,
    can_view_caixinhas: true,
  },
}

export function ConsultorInviteModal({ isOpen, onClose, familyId }: ConsultorInviteModalProps) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [selectedProfile, setSelectedProfile] = useState<ConsultorProfile>('acompanhador')
  const [permissions, setPermissions] = useState<ConsultorPermissionsInput>(
    PROFILE_PRESETS.acompanhador
  )
  const [isLoading, setIsLoading] = useState(false)
  const [createdToken, setCreatedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setEmail('')
      setMessage('')
      setSelectedProfile('acompanhador')
      setPermissions(PROFILE_PRESETS.acompanhador)
      setCreatedToken(null)
      setCopied(false)
    }
  }, [isOpen])

  const handleSelectProfile = (profile: ConsultorProfile) => {
    if (profile === 'custom') return
    setSelectedProfile(profile)
    setPermissions(PROFILE_PRESETS[profile])
  }

  const handlePermissionChange = (key: keyof ConsultorPermissionsInput, value: boolean) => {
    setSelectedProfile('custom')
    setPermissions((prev) => ({ ...prev, [key]: value, profile_preset: 'custom' }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Por favor, insira um email válido')
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await consultorService.createConsultorInvite({
        family_id: familyId,
        invited_email: email,
        profile_preset: selectedProfile,
        permissions,
        message: message || undefined,
      })

      if (error || !data) {
        toast.error(error?.message || 'Erro ao criar convite')
        return
      }

      setCreatedToken(data.token)
      toast.success('Convite de consultor criado!')
    } catch {
      toast.error('Erro ao criar convite. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const getInviteLink = () => {
    if (!createdToken) return ''
    return `${window.location.origin}/convite/${createdToken}`
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(getInviteLink())
      setCopied(true)
      toast.success('Link copiado!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Erro ao copiar link')
    }
  }

  if (createdToken) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Convite de Consultor Criado!">
        <div className="space-y-6">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Check className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-green-300 mb-1">Convite criado com sucesso!</p>
                <p className="text-xs text-gray-400">
                  Compartilhe o link abaixo com o consultor <span className="font-medium text-gray-300">{email}</span>
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Link do Convite</label>
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
                {copied ? <><Check className="w-4 h-4 mr-2" />Copiado</> : <><Copy className="w-4 h-4 mr-2" />Copiar</>}
              </Button>
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-300">
                <p className="font-medium text-blue-300 mb-2">Como funciona:</p>
                <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Copie o link e envie para o consultor</li>
                  <li>O consultor faz login ou cria uma conta com o email informado</li>
                  <li>Após aceitar, ele terá acesso à sua conta com as permissões definidas</li>
                  <li>Você pode ajustar as permissões a qualquer momento na aba Família</li>
                </ol>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Clock className="w-4 h-4" />
            <span>Este convite expira em 30 dias</span>
          </div>

          <Button type="button" variant="secondary" onClick={onClose} className="w-full">
            Fechar
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Convidar Consultor Financeiro">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-sm text-gray-300">
              <p className="font-medium text-blue-300 mb-1">Consultor Financeiro</p>
              <p className="text-xs text-gray-400">
                O consultor terá acesso de leitura à sua conta com as permissões que você definir. Transações individuais e histórico do "Posso Comprar?" nunca são expostos.
              </p>
            </div>
          </div>
        </div>

        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email do Consultor <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="consultor@email.com"
              required
              className="w-full pl-10 pr-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors"
            />
          </div>
          <p className="mt-1 text-xs text-gray-400">O consultor precisará usar este email para aceitar</p>
        </div>

        {/* Seleção de perfil */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Perfil de Acesso</label>
          <div className="space-y-2">
            <label
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedProfile === 'configurador'
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-dark-600 bg-dark-700/50 hover:border-primary-500/50'
              }`}
            >
              <input
                type="radio"
                name="profile"
                value="configurador"
                checked={selectedProfile === 'configurador'}
                onChange={() => handleSelectProfile('configurador')}
                className="mt-1 accent-primary-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Settings className="w-4 h-4 text-primary-400" />
                  <p className="font-medium text-gray-200">Consultor Configurador</p>
                </div>
                <p className="text-xs text-gray-400">
                  Ideal para a estruturação inicial. Pode criar envelopes, categorias e cadastrar contas.
                </p>
              </div>
            </label>

            <label
              className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                selectedProfile === 'acompanhador'
                  ? 'border-primary-500 bg-primary-500/10'
                  : 'border-dark-600 bg-dark-700/50 hover:border-primary-500/50'
              }`}
            >
              <input
                type="radio"
                name="profile"
                value="acompanhador"
                checked={selectedProfile === 'acompanhador'}
                onChange={() => handleSelectProfile('acompanhador')}
                className="mt-1 accent-primary-500"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="w-4 h-4 text-blue-400" />
                  <p className="font-medium text-gray-200">Consultor Acompanhador</p>
                </div>
                <p className="text-xs text-gray-400">
                  Ideal para acompanhamento contínuo. Apenas visualização — sem criar ou editar dados.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Permissões ajustáveis */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <label className="block text-sm font-medium text-gray-300">Permissões Individuais</label>
            {selectedProfile === 'custom' && (
              <span className="text-xs px-2 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full border border-yellow-500/20">
                Personalizado
              </span>
            )}
          </div>
          <div className="space-y-2 p-3 bg-dark-700/30 border border-dark-600 rounded-lg">
            <p className="text-xs text-gray-500 mb-3">Ajuste as permissões individualmente:</p>

            {[
              { key: 'can_create_envelopes' as const, label: 'Criar e editar envelopes' },
              { key: 'can_create_categories' as const, label: 'Criar e editar categorias' },
              { key: 'can_manage_accounts' as const, label: 'Cadastrar e editar contas bancárias/cartões' },
              { key: 'can_view_envelopes' as const, label: 'Visualizar envelopes e saldos' },
              { key: 'can_view_pocks' as const, label: 'Visualizar score Pocks' },
              { key: 'can_view_caixinhas' as const, label: 'Visualizar Metas e Sonhos (Caixinhas)' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={permissions[key]}
                  onChange={(e) => handlePermissionChange(key, e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
                />
                <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
                  {label}
                </span>
              </label>
            ))}

            <div className="mt-3 pt-3 border-t border-dark-600">
              <p className="text-xs text-gray-500 flex items-center gap-1">
                <span className="w-4 h-4 flex items-center justify-center text-gray-600">🔒</span>
                Transações individuais e histórico do "Posso Comprar?" são sempre restritos
              </p>
            </div>
          </div>
        </div>

        {/* Mensagem opcional */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Mensagem (opcional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex: Olá! Gostaria que você acompanhe minha conta no PocketWise..."
            className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-gray-200 placeholder-gray-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-colors resize-none"
            rows={2}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading} disabled={!email} className="flex-1">
            <Briefcase className="w-4 h-4 mr-2" />
            Gerar Convite
          </Button>
        </div>
      </form>
    </Modal>
  )
}
