import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LearningModeState {
  isEnabled: boolean
  toggleLearningMode: () => void
  setLearningMode: (enabled: boolean) => void
}

export const useLearningModeStore = create<LearningModeState>()(
  persist(
    (set) => ({
      isEnabled: false,
      toggleLearningMode: () => set((state) => ({ isEnabled: !state.isEnabled })),
      setLearningMode: (enabled) => set({ isEnabled: enabled }),
    }),
    {
      name: 'learning-mode-storage',
    }
  )
)
