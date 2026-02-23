import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserPreferences {
  // Perfil
  nome: string
  avatarUrl: string | null
  email: string | null

  // Preferências do App
  moeda: 'BRL' | 'USD' | 'EUR'
  diaInicioCiclo: number // Dia do mês que inicia o ciclo orçamentário
  temaDark: boolean

  // Notificações
  notificacoesAtivas: boolean
  lembreteDespesasVencendo: boolean
  lembreteMetasOrcamento: boolean

  // Dados
  ultimoBackup: string | null

  // Onboarding
  onboardingCompleted: boolean
  onboardingStep: number
}

interface UserPreferencesState extends UserPreferences {
  // Actions
  atualizarPerfil: (dados: Partial<Pick<UserPreferences, 'nome' | 'avatarUrl' | 'email'>>) => void
  atualizarPreferencias: (dados: Partial<UserPreferences>) => void
  resetarConfiguracoes: () => void
  registrarBackup: () => void
}

const defaultPreferences: UserPreferences = {
  nome: 'Usuário',
  avatarUrl: null,
  email: null,
  moeda: 'BRL',
  diaInicioCiclo: 1,
  temaDark: true,
  notificacoesAtivas: true,
  lembreteDespesasVencendo: true,
  lembreteMetasOrcamento: true,
  ultimoBackup: null,
  onboardingCompleted: false,
  onboardingStep: 0,
}

export const useUserPreferencesStore = create<UserPreferencesState>()(
  persist(
    (set) => ({
      ...defaultPreferences,

      atualizarPerfil: (dados) => {
        set((state) => ({
          ...state,
          ...dados,
        }))
      },

      atualizarPreferencias: (dados) => {
        set((state) => ({
          ...state,
          ...dados,
        }))
      },

      resetarConfiguracoes: () => {
        set(defaultPreferences)
      },

      registrarBackup: () => {
        set({ ultimoBackup: new Date().toISOString() })
      },
    }),
    {
      name: 'pocket-wise-user-preferences',
    }
  )
)
