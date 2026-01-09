export const dynamic = "force-dynamic"

export async function GET() {
  const serviceWorkerCode = `
// Service Worker - Platform-agnostic for iOS 17 and Android compatibility
// NO navigator/window usage inside service worker
const CACHE_NAME = "sherdor-mebel-v1"

const urlsToCache = [
  "/"
]

console.log('[SW] Service Worker initialized')

self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker...")
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Cache opened")
      return cache.add("/").catch((err) => {
        console.warn("[SW] Root page cache failed (non-critical):", err)
        return Promise.resolve()
      })
    }).then(() => {
      console.log("[SW] Installation complete, skipping old workers")
      return self.skipWaiting()
    })
  )
})

self.addEventListener("fetch", (event) => {
  // Only handle GET requests
  if (event.request.method !== "GET") {
    return
  }

  const url = new URL(event.request.url)
  const isAPI = url.pathname.startsWith("/api/")

  if (isAPI) {
    // Network-first for API calls
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cacheCopy = response.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, cacheCopy)
            })
          }
          return response
        })
        .catch(() => {
          return caches.match(event.request).then((cached) => {
            if (cached) {
              return cached
            }
            return new Response("Offline", { status: 503 })
          })
        })
    )
  } else {
    // Cache-first for assets
    event.respondWith(
      caches
        .match(event.request)
        .then((response) => response || fetch(event.request))
        .catch(() => new Response("Offline", { status: 503 }))
    )
  }
})

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker...")
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[SW] Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log("[SW] Claiming all clients")
        return self.clients.claim()
      })
  )
})

self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received")

  let notificationData = {
    title: "Sherdor Mebel",
    body: "Yangi xabar",
    icon: "/icon-192.png",
  }

  if (event.data) {
    try {
      const data = event.data.json()
      notificationData = { ...notificationData, ...data }
      console.log("[SW] Push data parsed successfully")
    } catch (error) {
      // Fallback to text data
      if (event.data.text) {
        notificationData.body = event.data.text()
      }
      console.log("[SW] Using text fallback for push data")
    }
  }

  const notificationOptions = {
    body: notificationData.body,
    icon: notificationData.icon,
    tag: "sherdor-mebel",
    requireInteraction: true,
    silent: false,
    data: {
      dateOfArrival: Date.now(),
      url: "/",
      ...notificationData.data,
    },
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationOptions)
      .then(() => {
        console.log("[SW] Notification displayed successfully")
      })
      .catch((error) => {
        console.error("[SW] Failed to show notification:", error)
      })
  )
})

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked")
  event.notification.close()

  const urlToOpen = event.notification.data?.url || "/"

  event.waitUntil(
    clients
      .matchAll({
        type: "window",
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Look for existing client with matching URL
        for (const client of clientList) {
          if (client.url === urlToOpen && "focus" in client) {
            console.log("[SW] Found existing client, focusing it")
            return client.focus()
          }
        }
        // No existing client, open new window
        if (clients.openWindow) {
          console.log("[SW] Opening new window")
          return clients.openWindow(urlToOpen)
        }
      })
      .catch((error) => {
        console.error("[SW] Error handling notification click:", error)
      })
  )
})

self.addEventListener("notificationclose", (event) => {
  console.log("[SW] Notification closed")
})

self.addEventListener("message", (event) => {
  console.log("[SW] Message received from client:", event.data.type)

  if (event.data.type === "SKIP_WAITING") {
    console.log("[SW] Skipping waiting, activating immediately")
    self.skipWaiting()
  }

  if (event.data.type === "SYNC_SUBSCRIPTIONS") {
    console.log("[SW] Syncing subscriptions")
    syncSubscriptions()
  }
})

if ('periodicSync' in self.registration) {
  self.addEventListener("periodicsync", (event) => {
    if (event.tag === "sync-subscriptions") {
      console.log("[SW] Periodic sync triggered")
      event.waitUntil(syncSubscriptions())
    }
  })
}

async function syncSubscriptions() {
  try {
    console.log("[SW] Syncing push subscription status...")
    const subscription = await self.registration.pushManager.getSubscription()
    if (subscription) {
      console.log("[SW] Active subscription found, notifying clients")
      const clients = await self.clients.matchAll()
      clients.forEach((client) => {
        client.postMessage({
          type: "SUBSCRIPTION_ACTIVE",
          subscription: {
            endpoint: subscription.endpoint,
          },
        })
      })
    }
  } catch (error) {
    console.error("[SW] Error syncing subscriptions:", error)
  }
}
`

  return new Response(serviceWorkerCode, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  })
}
