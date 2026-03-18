/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

declare const self: ServiceWorkerGlobalScope

// ============================================================================
// Workbox Precaching (injected by vite-plugin-pwa at build time)
// ============================================================================

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ============================================================================
// Push Notification Handler
// ============================================================================

interface PushPayload {
  title: string
  body: string
  url?: string
  tag?: string
  urgent?: boolean
  icon?: string
  badge?: string
}

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload: PushPayload
  try {
    payload = event.data.json() as PushPayload
  } catch {
    payload = {
      title: 'Pocket Wise',
      body: event.data.text(),
    }
  }

  const { title, body, url = '/app', tag = 'pocketwise', urgent = false, icon, badge } = payload

  const notificationOptions: NotificationOptions = {
    body,
    icon: icon ?? '/pwa-192x192.svg',
    badge: badge ?? '/notification-badge.png',
    tag,
    data: { url },
    requireInteraction: urgent,
    vibrate: urgent ? [200, 100, 200] : [100],
  }

  event.waitUntil(
    self.registration.showNotification(title, notificationOptions)
  )
})

// ============================================================================
// Notification Click Handler
// Opens the app (or focuses existing window) and navigates to the target URL
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = (event.notification.data?.url as string) ?? '/app'

  event.waitUntil(
    (self.clients as Clients)
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if already open
        for (const client of clientList) {
          const clientWindow = client as WindowClient
          if ('focus' in clientWindow) {
            void clientWindow.navigate(targetUrl)
            return clientWindow.focus()
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl)
        }
      })
  )
})

// ============================================================================
// Push Subscription Change Handler
// Called when browser rotates push credentials (auto-resubscribe)
// ============================================================================

self.addEventListener('pushsubscriptionchange', (event) => {
  const pushEvent = event as PushSubscriptionChangeEvent
  event.waitUntil(
    self.registration.pushManager
      .subscribe(pushEvent.oldSubscription?.options ?? { userVisibleOnly: true })
      .then((subscription) => {
        // Post new subscription to the app to sync with Supabase
        return (self.clients as Clients)
          .matchAll({ type: 'window' })
          .then((clientList) => {
            for (const client of clientList) {
              client.postMessage({
                type: 'PUSH_SUBSCRIPTION_CHANGED',
                subscription: subscription.toJSON(),
              })
            }
          })
      })
  )
})
