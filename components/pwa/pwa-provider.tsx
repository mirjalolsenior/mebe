"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"

interface PWAContextType {
  isInstalled: boolean
  isInstallable: boolean
  installPWA: () => Promise<void>
  notificationPermission: NotificationPermission
  requestNotificationPermission: () => Promise<void>
  sendNotification: (title: string, body: string) => void
  scheduleNotification: (title: string, body: string, delayMinutes: number) => void
  subscribeToPush: () => Promise<void>
  unsubscribeFromPush: () => Promise<void>
  isPushSupported: boolean
  isSubscribed: boolean
  platform: "ios" | "android" | "unknown"
}

const PWAContext = createContext<PWAContextType | undefined>(undefined)

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isInstallable, setIsInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default")
  const [isPushSupported, setIsPushSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [platform, setPlatform] = useState<"ios" | "android" | "unknown">("unknown")

  useEffect(() => {
    // Check if app is installed
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      console.log("[PWA] App running in standalone mode (installed)")
    }

    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
      console.log("[PWA] Current notification permission:", Notification.permission)
    }

    // Check if push is supported - CRITICAL: Must check BOTH serviceWorker AND PushManager
    const hasPushSupport = "serviceWorker" in navigator && "PushManager" in window
    setIsPushSupported(hasPushSupport)
    console.log("[PWA] Push API support:", hasPushSupport)

    // Listen for install prompt - IMPORTANT: Only on Android, iOS shows "Add to Home Screen" differently
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
      console.log("[PWA] Install prompt available (Android only)")
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    detectPlatform()
    registerServiceWorker()

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const detectPlatform = () => {
    const ua = navigator.userAgent
    if (/iPad|iPhone|iPod/.test(ua)) {
      setPlatform("ios")
      console.log("[PWA] Detected iOS platform")
    } else if (/Android/.test(ua)) {
      setPlatform("android")
      console.log("[PWA] Detected Android platform")
    } else {
      console.log("[PWA] Unknown platform - may be desktop or other device")
    }
  }

  const registerServiceWorker = async () => {
    try {
      // Skip in preview environment
      if (typeof window !== "undefined" && window.location.hostname.includes("vusercontent")) {
        console.log("[PWA] Service Worker skipped in preview environment")
        return
      }

      if (!("serviceWorker" in navigator)) {
        console.warn("[PWA] Service Workers not supported in this browser")
        return
      }

      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/", // Critical: Explicit scope ensures SW handles all routes
      })
      console.log("[PWA] Service Worker registered successfully:", registration.scope)

      if (isPushSupported) {
        try {
          const subscription = await registration.pushManager.getSubscription()
          if (subscription) {
            setIsSubscribed(true)
            console.log("[PWA] Active push subscription found on load")
          }
        } catch (error) {
          console.warn("[PWA] Failed to check push subscription:", error)
        }
      }

      if (platform === "android" && "periodicSync" in registration) {
        try {
          await registration.periodicSync.register("sync-subscriptions", {
            minInterval: 24 * 60 * 60 * 1000,
          })
          console.log("[PWA] Periodic sync registered for Android")
        } catch (error) {
          console.warn("[PWA] Periodic sync registration failed:", error)
        }
      }

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data.type === "SUBSCRIPTION_ACTIVE") {
          setIsSubscribed(true)
          console.log("[PWA] Service Worker confirmed subscription is active")
        }
      })

      // Check for updates periodically
      const updateInterval = setInterval(() => {
        registration.update()
      }, 60000)

      return () => clearInterval(updateInterval)
    } catch (error) {
      console.error("[PWA] Service Worker registration failed:", error)
    }
  }

  const subscribeToPush = async () => {
    try {
      if (!("serviceWorker" in navigator)) {
        throw new Error("Service Workers are not supported")
      }

      if (!("PushManager" in window)) {
        throw new Error("Push Manager is not supported")
      }

      console.log("[PWA] Starting push subscription process...")

      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        console.log("[PWA] No existing subscription found, creating new one...")

        // Fetch VAPID public key
        let response
        try {
          response = await fetch("/api/push-public-key")
        } catch (error) {
          console.error("[PWA] Failed to fetch VAPID public key:", error)
          throw new Error("Could not fetch VAPID configuration from server")
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch VAPID key: ${response.statusText}`)
        }

        const { publicKey } = await response.json()

        if (!publicKey) {
          throw new Error("VAPID public key is missing from server response")
        }

        console.log("[PWA] VAPID key retrieved, subscribing to push...")

        try {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true, // Critical: Must be true for iOS compatibility
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          })
          console.log("[PWA] Push subscription created successfully")
        } catch (subscribeError: any) {
          console.error("[PWA] Push subscription failed:", subscribeError)

          if (subscribeError.name === "NotAllowedError") {
            const errorMsg =
              platform === "ios"
                ? "iOS: Notifications require explicit permission. Check Settings > Notifications > Sherdor Mebel"
                : "Notification permission was denied. Check browser settings"
            throw new Error(errorMsg)
          }

          throw subscribeError
        }

        // Send subscription to server
        console.log("[PWA] Sending subscription to server...")
        const subscribeResponse = await fetch("/api/push-subscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...subscription,
            platform,
          }),
        })

        if (subscribeResponse.ok) {
          setIsSubscribed(true)
          console.log("[PWA] Successfully subscribed to push notifications on server")
        } else {
          console.error("[PWA] Server rejected subscription:", subscribeResponse.statusText)
        }
      } else {
        setIsSubscribed(true)
        console.log("[PWA] Already subscribed to push notifications")
      }
    } catch (error) {
      console.error("[PWA] Push subscription error:", error)
      setIsSubscribed(false)
      throw error
    }
  }

  const unsubscribeFromPush = async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        return
      }

      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Notify server
        await fetch("/api/push-unsubscribe", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })

        await subscription.unsubscribe()
        setIsSubscribed(false)
        console.log("[PWA] Unsubscribed from push notifications")
      }
    } catch (error) {
      console.error("[PWA] Push unsubscription error:", error)
    }
  }

  const installPWA = async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setIsInstallable(false)
      setIsInstalled(true)
      setDeferredPrompt(null)
      console.log("[PWA] App installed successfully")
    }
  }

  // Only request after user interaction (button click in NotificationManager)
  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      console.warn("[PWA] Notifications not supported on this browser")
      return
    }

    try {
      console.log("[PWA] Requesting notification permission...")

      if (platform === "ios") {
        console.log("[PWA] iOS: Permission request initiated")
      }

      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      console.log("[PWA] Notification permission result:", permission)

      if (permission === "granted") {
        console.log("[PWA] Permission granted, attempting to subscribe to push...")
        if (isPushSupported) {
          try {
            await subscribeToPush()
          } catch (error) {
            console.error("[PWA] Failed to subscribe after permission grant:", error)
          }
        }
      } else if (permission === "denied") {
        console.warn("[PWA] Notification permission denied by user")
      }
    } catch (error) {
      console.error("[PWA] Notification permission error:", error)
    }
  }

  const sendNotification = (title: string, body: string) => {
    if (notificationPermission === "granted") {
      try {
        new Notification(title, {
          body,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          vibrate: [100, 50, 100],
        })
        console.log("[PWA] Notification sent:", title)
      } catch (error) {
        console.error("[PWA] Failed to send notification:", error)
      }
    }
  }

  const scheduleNotification = (title: string, body: string, delayMinutes: number) => {
    if (notificationPermission === "granted") {
      setTimeout(
        () => {
          sendNotification(title, body)
        },
        delayMinutes * 60 * 1000,
      )
    }
  }

  return (
    <PWAContext.Provider
      value={{
        isInstalled,
        isInstallable,
        installPWA,
        notificationPermission,
        requestNotificationPermission,
        sendNotification,
        scheduleNotification,
        subscribeToPush,
        unsubscribeFromPush,
        isPushSupported,
        isSubscribed,
        platform,
      }}
    >
      {children}
    </PWAContext.Provider>
  )
}

export function usePWA() {
  const context = useContext(PWAContext)
  if (context === undefined) {
    throw new Error("usePWA must be used within a PWAProvider")
  }
  return context
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
