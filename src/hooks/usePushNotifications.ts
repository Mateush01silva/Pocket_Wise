import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ============================================================================
// Types
// ============================================================================

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

export interface PushNotificationPreferences {
  envelope_burst: boolean
  expense_overdue: boolean
  credit_card_limit: boolean
  trial_expiring: boolean
  month_end_reminder: boolean
  savings_goals: boolean
  ai_proactive: boolean
  credit_card_due_date: boolean
  unusual_spending: boolean
  no_transactions_reminder: boolean
  month_start_checkin: boolean
  perfect_month: boolean
}

const DEFAULT_PREFERENCES: PushNotificationPreferences = {
  envelope_burst: true,
  expense_overdue: true,
  credit_card_limit: true,
  trial_expiring: true,
  month_end_reminder: true,
  savings_goals: true,
  ai_proactive: true,
  credit_card_due_date: true,
  unusual_spending: true,
  no_transactions_reminder: false,
  month_start_checkin: true,
  perfect_month: true,
}

// ============================================================================
// Helpers
// ============================================================================

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const arr = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    arr[i] = rawData.charCodeAt(i)
  }
  return arr.buffer as ArrayBuffer
}

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// ============================================================================
// Hook
// ============================================================================

export function usePushNotifications() {
  const [isSupported] = useState(isPushSupported)
  const [permission, setPermission] = useState<PushPermissionState>(() => {
    if (!isPushSupported()) return 'unsupported'
    return (Notification.permission as PushPermissionState) ?? 'default'
  })
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [preferences, setPreferences] = useState<PushNotificationPreferences>(DEFAULT_PREFERENCES)

  // ---- Check existing subscription on mount --------------------------------

  useEffect(() => {
    if (!isSupported) return

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        setIsSubscribed(!!existing)
      } catch {
        setIsSubscribed(false)
      }
    }

    void checkSubscription()
  }, [isSupported])

  // ---- Load preferences from Supabase on mount -----------------------------

  useEffect(() => {
    if (!supabase) return

    const loadPreferences = async () => {
      const { data: { user } } = await supabase!.auth.getUser()
      if (!user) return

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('push_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setPreferences({
          envelope_burst           : data.envelope_burst            ?? true,
          expense_overdue          : data.expense_overdue           ?? true,
          credit_card_limit        : data.credit_card_limit         ?? true,
          trial_expiring           : data.trial_expiring            ?? true,
          month_end_reminder       : data.month_end_reminder        ?? true,
          savings_goals            : data.savings_goals             ?? true,
          ai_proactive             : data.ai_proactive              ?? true,
          credit_card_due_date     : data.credit_card_due_date      ?? true,
          unusual_spending         : data.unusual_spending          ?? true,
          no_transactions_reminder : data.no_transactions_reminder  ?? false,
          month_start_checkin      : data.month_start_checkin       ?? true,
          perfect_month            : data.perfect_month             ?? true,
        })
      }
    }

    void loadPreferences()
  }, [])

  // ---- Listen for SW messages (subscription changed) -----------------------

  useEffect(() => {
    if (!isSupported) return

    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_CHANGED') {
        void syncSubscriptionWithSupabase(event.data.subscription as PushSubscriptionJSON)
      }
    }

    navigator.serviceWorker.addEventListener('message', handler)
    return () => navigator.serviceWorker.removeEventListener('message', handler)
  }, [isSupported])

  // ---- Save subscription to Supabase ---------------------------------------

  const syncSubscriptionWithSupabase = async (subscriptionJson: PushSubscriptionJSON) => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const keys = subscriptionJson.keys as { p256dh: string; auth: string } | undefined
    if (!subscriptionJson.endpoint || !keys?.p256dh || !keys?.auth) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('push_subscriptions').upsert(
      {
        user_id   : user.id,
        endpoint  : subscriptionJson.endpoint,
        p256dh    : keys.p256dh,
        auth      : keys.auth,
        user_agent: navigator.userAgent,
        is_active : true,
      },
      { onConflict: 'user_id,endpoint' }
    )
  }

  // ---- Remove subscription from Supabase -----------------------------------

  const removeSubscriptionFromSupabase = async (endpoint: string) => {
    if (!supabase) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('user_id', user.id)
      .eq('endpoint', endpoint)
  }

  // ---- Subscribe -----------------------------------------------------------

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !supabase) return false
    setIsLoading(true)

    try {
      // 1. Request browser permission
      const result = await Notification.requestPermission()
      setPermission(result as PushPermissionState)

      if (result !== 'granted') {
        setIsLoading(false)
        return false
      }

      // 2. Get service worker registration
      const registration = await navigator.serviceWorker.ready

      // 3. Subscribe to push
      const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string
      if (!vapidPublicKey) {
        console.error('[PushNotifications] VITE_VAPID_PUBLIC_KEY not set')
        setIsLoading(false)
        return false
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly   : true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
      })

      // 4. Persist to Supabase
      await syncSubscriptionWithSupabase(subscription.toJSON())
      setIsSubscribed(true)
      return true
    } catch (error) {
      console.error('[PushNotifications] subscribe error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  // ---- Unsubscribe ---------------------------------------------------------

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false
    setIsLoading(true)

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await removeSubscriptionFromSupabase(subscription.endpoint)
        await subscription.unsubscribe()
      }

      setIsSubscribed(false)
      return true
    } catch (error) {
      console.error('[PushNotifications] unsubscribe error:', error)
      return false
    } finally {
      setIsLoading(false)
    }
  }, [isSupported])

  // ---- Update a single preference -----------------------------------------

  const updatePreference = useCallback(
    async (key: keyof PushNotificationPreferences, value: boolean) => {
      if (!supabase) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const updated = { ...preferences, [key]: value }
      setPreferences(updated)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from('push_notification_preferences').upsert(
        { user_id: user.id, ...updated },
        { onConflict: 'user_id' }
      )
    },
    [preferences]
  )

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    preferences,
    subscribe,
    unsubscribe,
    updatePreference,
  }
}
