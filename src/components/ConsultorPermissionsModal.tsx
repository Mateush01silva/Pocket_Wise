import { useState, useEffect } from 'react'
import { Settings, UserCheck, Save } from 'lucide-react'
import { Modal } from './ui/Modal'
import { Button } from './ui/Button'
import { consultorService } from '../services/consultorService'
import { toast } from 'sonner'
import type { ConsultorPermissionsWithDetails, ConsultorPermissionsInput, ConsultorProfile } from '../types'

interface ConsultorPermissionsModalProps {
  isOpen: boolean
  onClose: () => void
  permissions: ConsultorPermissionsWithDetails
  onSave: (updated: ConsultorPermissionsInput) => void
}

export function ConsultorPermissionsModal({
  isOpen,
  onClose,
  permissions,
  onSave,
}: ConsultorPermissionsModalProps) {
  const [current, setCurrent] = useState<ConsultorPermissionsInput>({
    can_create_envelopes: permissions.can_create_envelopes,
    can_create_categories: permissions.can_create_categories,
    can_manage_accounts: permissions.can_manage_accounts,
    can_view_envelopes: permissions.can_view_envelopes,
    can_view_pocks: permissions.can_view_pocks,
    can_view_caixinhas: permissions.can_view_caixinhas,
  })
  const [profile, setProfile] = useState<ConsultorProfile>(permissions.profile_preset || 'custom')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCurrent({
        can_create_envelopes: permissions.can_create_envelopes,
        can_create_categories: permissions.can_create_categories,
        can_manage_accounts: permissions.can_manage_accounts,
        can_view_envelopes: permissions.can_view_envelopes,
        can_view_pocks: permissions.can_view_pocks,
        can_view_caixinhas: permissions.can_view_caixinhas,
      })
      setProfile(permissions.profile_preset || 'custom')
    }
  }, [isOpen, permissions])

  const applyProfile = (p: ConsultorProfile) => {
    setProfile(p)
    if (p === 'configurador') {
      setCurrent({
        can_create_envelopes: true,
        can_create_categories: true,
        can_manage_accounts: true,
        can_view_envelopes: true,
        can_view_pocks: true,
        can_view_caixinhas: true,
      })
    } else if (p === 'acompanhador') {
      setCurrent({
        can_create_envelopes: false,
        can_create_categories: false,
        can_manage_accounts: false,
        can_view_envelopes: true,
        can_view_pocks: true,
        can_view_caixinhas: true,
      })
    }
  }

  const handlePermissionChange = (key: keyof ConsultorPermissionsInput, value: boolean) => {
    setProfile('custom')
    setCurrent((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setIsLoading(true)
    try {
      const { error } = await consultorService.updateConsultorPermissions(
        permissions.family_member_id,
        { ...current, profile_preset: profile }
      )

      if (error) {
        toast.error(error.message || 'Erro ao salvar permissões')
        return
      }

      toast.success('Permissões atualizadas!')
      onSave({ ...current, profile_preset: profile })
      onClose()
    } catch {
      toast.error('Erro ao salvar permissões. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Permissões — ${permissions.consultant_name}`}>
      <div className="space-y-6">
        {/* Perfis pré-definidos */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Aplicar Perfil Base</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => applyProfile('configurador')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                profile === 'configurador'
                  ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                  : 'border-dark-600 bg-dark-700/50 text-gray-400 hover:border-primary-500/50'
              }`}
            >
              <Settings className="w-4 h-4" />
              Configurador
            </button>
            <button
              type="button"
              onClick={() => applyProfile('acompanhador')}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                profile === 'acompanhador'
                  ? 'border-primary-500 bg-primary-500/10 text-primary-300'
                  : 'border-dark-600 bg-dark-700/50 text-gray-400 hover:border-primary-500/50'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Acompanhador
            </button>
            {profile === 'custom' && (
              <div className="flex items-center px-3 py-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-sm">
                Personalizado
              </div>
            )}
          </div>
        </div>

        {/* Permissões individuais */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">Permissões Individuais</label>
          <div className="space-y-3 p-4 bg-dark-700/30 border border-dark-600 rounded-lg">
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
                  checked={current[key]}
                  onChange={(e) => handlePermissionChange(key, e.target.checked)}
                  className="w-4 h-4 rounded accent-primary-500 cursor-pointer"
                />
                <span className="text-sm text-gray-300 group-hover:text-gray-200 transition-colors">
                  {label}
                </span>
              </label>
            ))}

            <div className="mt-2 pt-3 border-t border-dark-600">
              <p className="text-xs text-gray-500">
                🔒 Transações individuais e histórico do "Posso Comprar?" são sempre restritos por design
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} isLoading={isLoading} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            Salvar Permissões
          </Button>
        </div>
      </div>
    </Modal>
  )
}
