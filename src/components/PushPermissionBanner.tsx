import { useState, useEffect } from 'react'
import { Bell, X, Smartphone } from 'lucide-react'
import { usePushNotifications } from '../hooks/usePushNotifications'

// ============================================================================
// Smart permission banner
// Shows a non-intrusive banner after the user has visited the app 3 times
// OR when an urgent in-app notification appears (envelope burst, etc.)
// If dismissed, won't show again for 30 days.
// ============================================================================

const STORAGE_KEY = 'pocketwise-push-banner'
const VISIT_COUNT_KEY = 'pocketwise-visit-count'
const SHOW_THRESHOLD = 3 // show after N visits
const DISMISSED_DAYS = 30

interface BannerState {
  dismissedAt?: string
  neverAsk?: boolean
}

function shouldShowBanner(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false

    const state: BannerState = JSON.parse(raw)

    if (state.neverAsk) return false

    if (state.dismissedAt) {
      const dismissed = new Date(state.dismissedAt)
      const diffDays = (Date.now() - dismissed.getTime()) / (1000 * 60 * 60 * 24)
      if (diffDays < DISMISSED_DAYS) return false
    }

    return true
  } catch {
    return false
  }
}

function incrementVisitCount(): number {
  try {
    const count = parseInt(localStorage.getItem(VISIT_COUNT_KEY) ?? '0', 10)
    const next = count + 1
    localStorage.setItem(VISIT_COUNT_KEY, String(next))
    return next
  } catch {
    return 0
  }
}

function markBannerEligible() {
  if (!localStorage.getItem(STORAGE_KEY)) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({}))
  }
}

export function PushPermissionBanner() {
  const { isSupported, isSubscribed, permission, subscribe, isLoading } = usePushNotifications()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isSupported || isSubscribed || permission === 'denied' || permission === 'granted') {
      return
    }

    const visits = incrementVisitCount()
    if (visits >= SHOW_THRESHOLD) {
      markBannerEligible()
    }

    if (shouldShowBanner()) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 2000)
      return () => clearTimeout(timer)
    }
  }, [isSupported, isSubscribed, permission])

  const handleEnable = async () => {
    const granted = await subscribe()
    if (granted) {
      setVisible(false)
    }
  }

  const handleDismiss = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dismissedAt: new Date().toISOString() }))
    } catch { /* noop */ }
  }

  const handleNeverAsk = () => {
    setVisible(false)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ neverAsk: true }))
    } catch { /* noop */ }
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:w-96 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-indigo-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white leading-snug">
              Receba alertas no celular
            </p>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              Seja avisado quando um envelope estourar, uma conta vencer ou seu trial estiver acabando.
            </p>

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => void handleEnable()}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Bell className="w-3.5 h-3.5" />
                {isLoading ? 'Ativando...' : 'Ativar notificações'}
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200 text-xs rounded-lg transition-colors"
              >
                Agora não
              </button>
            </div>
          </div>

          <button
            onClick={handleNeverAsk}
            className="flex-shrink-0 p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Fechar e não mostrar novamente"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
