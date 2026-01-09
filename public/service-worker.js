// Clean, minimal service worker for PWA support
// No window, navigator, or platform detection - purely server-side logic

// Install event: cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("sherdor-mebel-v1").then((cache) => {
      // Only cache homepage - user will load other routes on demand
      return cache.addAll(["/"]).catch(() => {
        // Fail silently if cache fails - app still works
        console.log("[SW] Cache install attempted")
      })
    }),
  )
  self.skipWaiting() // Activate immediately
})

// Activate event: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== "sherdor-mebel-v1") {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )
  self.clients.claim() // Take control immediately
})

// Fetch event: network-first strategy
self.addEventListener("fetch", (event) => {
  // Skip non-GET requests
  if (event.request.method !== "GET") {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response && response.status === 200) {
          const cache = caches.open("sherdor-mebel-v1")
          cache.then((c) => c.put(event.request, response.clone()))
        }
        return response
      })
      .catch(() => {
        // Fall back to cache on network failure
        return caches.match(event.request)
      }),
  )
})

// Push event: handle incoming push notifications
self.addEventListener("push", (event) => {
  let data = {
    title: "Sherdor Mebel",
    body: "Yangi bildirishnoma",
  }

  try {
    if (event.data) {
      data = event.data.json()
    }
  } catch (error) {
    // If JSON parsing fails, use event.data as plain text body
    if (event.data) {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      // Note: iOS 17 ignores vibrate, tag, and actions - only title + body work
      tag: "notification",
      requireInteraction: false,
    }),
  )
})

// Notification click event: focus window or open new one
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url === "/" && "focus" in client) {
          return client.focus()
        }
      }
      // Open new window if none exists
      if (clients.openWindow) {
        return clients.openWindow("/")
      }
    }),
  )
})
