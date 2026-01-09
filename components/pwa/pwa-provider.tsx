"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { urlBase64ToUint8Array } from "@/lib/vapid-helpers"

interface PWAContextType {
  isInstalled: boolean
  isInstallable: boolean
  installPWA: () => Promise<void>
  notificationPermission: NotificationPermission
  requestNotificationPermission: () => Promise<void>
  subscribeToPush: () => Promise<void>
  unsubscribeFromPush: () => Promise<void>
  isPushSupported: boolean
  isSubscribed: boolean
}

const PWAContext = createContext<PWAContextType | undefined>(undefined)

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isInstallable, setIsInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default")
  const [isPushSupported, setIsPushSupported] = useState(false)
  const [isSubscribed, setIsSubscribed] = useState(false)

  useEffect(() => {
    // Check if app is installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true)
      console.log("[PWA] App running in standalone mode")
    }

    // Check notification permission
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission)
    }

    // Check push API support
    const hasPushSupport = "serviceWorker" in navigator && "PushManager" in window
    setIsPushSupported(hasPushSupport)

    // Listen for install prompt (Android only)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)

    // Register service worker
    registerServiceWorker()

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    }
  }, [])

  const registerServiceWorker = async () => {
    try {
      // Skip in preview environments
      if (typeof window !== "undefined" && window.location.hostname.includes("vusercontent")) {
        return
      }

      if (!("serviceWorker" in navigator)) {
        return
      }

      await navigator.serviceWorker.register("/service-worker.js", {
        scope: "/",
      })

      // Check if already subscribed
      if (isPushSupported) {
        const registration = await navigator.serviceWorker.ready
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          setIsSubscribed(true)
        }
      }
    } catch (error) {
      console.error("[PWA] Service Worker registration failed:", error)
    }
  }

  const requestNotificationPermission = async () => {
    if (!("Notification" in window)) {
      throw new Error("Notifications not supported")
    }

    try {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
      return permission
    } catch (error) {
      console.error("[PWA] Permission request error:", error)
      throw error
    }
  }

  const subscribeToPush = async () => {
    if (!isPushSupported) {
      throw new Error("Push notifications not supported")
    }

    try {
      const registration = await navigator.serviceWorker.ready
      let subscription = await registration.pushManager.getSubscription()

      if (!subscription) {
        // Fetch VAPID public key from server
        const response = await fetch("/api/push-public-key")
        if (!response.ok) {
          throw new Error("Failed to fetch VAPID key")
        }

        const { publicKey } = await response.json()
        if (!publicKey) {
          throw new Error("VAPID public key missing")
        }

        // Convert Base64URL to Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(publicKey)

        // Subscribe to push
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        })

        // Send subscription to server
        await fetch("/api/push-subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription),
        })
      }

      setIsSubscribed(true)
    } catch (error) {
      console.error("[PWA] Push subscription error:", error)
      throw error
    }
  }

  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await fetch("/api/push-unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })

        await subscription.unsubscribe()
        setIsSubscribed(false)
      }
    } catch (error) {
      console.error("[PWA] Unsubscribe error:", error)
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
        subscribeToPush,
        unsubscribeFromPush,
        isPushSupported,
        isSubscribed,
      }}
    >
      {children}
    </PWAContext.Provider>
  )
}

export function usePWA() {
  const context = useContext(PWAContext)
  if (context === undefined) {
    throw new Error("usePWA must be used within PWAProvider")
  }
  return context
}
