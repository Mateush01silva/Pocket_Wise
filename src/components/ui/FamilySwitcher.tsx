import { useState } from 'react'
import { ChevronDown, Home, Users, Check, Loader2 } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useAuth } from '../../contexts/AuthContext'
import { toast } from 'sonner'
import { useCategoriasStore, useTransacoesStore, useCartoesStore, useContasBancariasStore, useAssinaturasStore } from '../../store'
import { useFamilyStore } from '../../store/useFamilyStore'
import { useCaixinhasStore } from '../../store/useCaixinhasStore'
import { useOrcamentosStore } from '../../store/useOrcamentosStore'

export function FamilySwitcher() {
  const { userFamilies, activeFamilyId, personalFamilyId, switchFamily, isPersonalSubValid } = useAuth()
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState(false)

  // Só renderizar se o usuário pertencer a mais de uma família
  if (userFamilies.length <= 1) return null

  const activeFamily = userFamilies.find((f) => f.family_id === activeFamilyId)
  const isPersonalActive = activeFamilyId === personalFamilyId

  const handleSwitch = async (familyId: string) => {
    if (familyId === activeFamilyId || switching) return

    // Ao voltar para conta pessoal, verificar se assinatura própria ainda é válida
    if (familyId === personalFamilyId && !isPersonalSubValid()) {
      setOpen(false)
      window.location.href = '/app/assinar'
      return
    }

    setOpen(false)
    setSwitching(true)
    try {
      const result = await switchFamily(familyId)
      if (result.success) {
        // Recarregar os stores da nova família SEM window.location.reload():
        // o reload completo descartava formulários em andamento e qualquer
        // estado de navegação do usuário.
        useFamilyStore.getState().reset()
        await Promise.all([
          useCategoriasStore.getState().fetchCategorias(),
          useTransacoesStore.getState().fetchLancamentos(),
          useCartoesStore.getState().fetchCartoes(),
          useContasBancariasStore.getState().fetchContas(),
          useFamilyStore.getState().initialize(),
          useAssinaturasStore.getState().initialize(),
          // initialize() destes stores tem guarda "já inicializado" — usar os
          // fetches diretos para forçar os dados da nova família
          useCaixinhasStore.getState().fetchCaixinhas(),
          useCaixinhasStore.getState().fetchSummary(),
          useOrcamentosStore.getState().fetchOrcamentos(),
        ])
        toast.success('Família trocada com sucesso')
      } else {
        toast.error(result.error ?? 'Erro ao trocar de família')
      }
    } catch (error) {
      console.error('Erro ao recarregar dados da nova família:', error)
      // Fallback seguro: garante consistência mesmo se algum store falhar
      window.location.reload()
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={switching}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200',
          'bg-dark-800/50 border border-dark-700/50 hover:border-primary-500/30 hover:bg-dark-800',
          'text-left'
        )}
      >
        {switching ? (
          <Loader2 className="w-4 h-4 text-primary-400 animate-spin shrink-0" />
        ) : isPersonalActive ? (
          <Home className="w-4 h-4 text-primary-400 shrink-0" />
        ) : (
          <Users className="w-4 h-4 text-secondary-400 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400">Contexto ativo</p>
          <p className="text-sm font-medium text-gray-200 truncate">
            {switching ? 'Trocando...' : (activeFamily?.nome ?? 'Minha Família')}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'w-4 h-4 text-gray-500 shrink-0 transition-transform duration-200',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-dark-800 border border-dark-700/50 rounded-lg shadow-xl overflow-hidden z-50">
          <p className="text-xs text-gray-500 px-3 pt-2 pb-1 uppercase tracking-wider">
            Suas famílias
          </p>
          {userFamilies.map((family) => {
            const isActive = family.family_id === activeFamilyId
            const isPersonal = family.family_id === personalFamilyId
            return (
              <button
                key={family.family_id}
                onClick={() => handleSwitch(family.family_id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 transition-all duration-150 text-left',
                  isActive
                    ? 'bg-primary-500/10 text-primary-300'
                    : 'text-gray-300 hover:bg-dark-700/70 hover:text-white'
                )}
              >
                {isPersonal ? (
                  <Home className="w-4 h-4 shrink-0 text-primary-400" />
                ) : (
                  <Users className="w-4 h-4 shrink-0 text-secondary-400" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{family.nome}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {isPersonal ? 'Minha conta' : family.role}
                  </p>
                </div>
                {isActive && <Check className="w-4 h-4 text-primary-400 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
