"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bell, BellOff, Smartphone, CheckCircle, AlertCircle } from "lucide-react"
import { usePWA } from "./pwa-provider"

export function NotificationManager() {
  const [isInstallable, setIsInstallable] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const {
    notificationPermission,
    isPushSupported,
    isSubscribed,
    requestNotificationPermission,
    subscribeToPush,
    installPWA,
  } = usePWA()

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
  }, [])

  const handleEnableNotifications = async () => {
    try {
      setSubscriptionError(null)
      const permission = await requestNotificationPermission()

      if (permission === "granted" && isPushSupported) {
        try {
          await subscribeToPush()
        } catch (error: any) {
          setSubscriptionError(error.message || "Failed to subscribe to push notifications")
        }
      }
    } catch (error: any) {
      setSubscriptionError(error.message || "Failed to request notification permission")
    }
  }

  const handleInstallPWA = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === "accepted") {
          setIsInstallable(false)
          setDeferredPrompt(null)
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      {/* PWA Installation */}
      {isInstallable && (
        <Card className="glass-card animate-slideIn border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Ilovani o'rnatish
            </CardTitle>
            <CardDescription>Sherdor Mebel ilovasini telefoningizga o'rnating</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleInstallPWA} className="w-full">
              <Smartphone className="w-4 h-4 mr-2" />
              Ilovani o'rnatish
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Notification Settings */}
      <Card className="glass-card animate-slideIn">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {notificationPermission === "granted" ? (
              <Bell className="w-5 h-5 text-green-500" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
            Bildirishnomalar
          </CardTitle>
          <CardDescription>Muhim eslatmalar va yangilanishlar uchun bildirishnomalarni yoqing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Holat:{" "}
              {notificationPermission === "granted"
                ? "Yoqilgan"
                : notificationPermission === "denied"
                  ? "O'chirilgan"
                  : "Aniqlanmagan"}
            </span>
            {notificationPermission === "granted" && (
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            )}
          </div>

          {notificationPermission === "denied" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <strong>Bildirishnomalar o'chirilgan:</strong>
              <p className="mt-1">Brauzer sozlamalarida bildirishnomalarni qayta yoqib ko'ring</p>
            </div>
          )}

          {notificationPermission !== "granted" && (
            <Button onClick={handleEnableNotifications} className="w-full">
              <Bell className="w-4 h-4 mr-2" />
              Bildirishnomalarni yoqish
            </Button>
          )}

          {subscriptionError && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              <strong>Xato:</strong> {subscriptionError}
            </div>
          )}

          {notificationPermission === "granted" && isSubscribed && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
              <CheckCircle className="w-4 h-4 inline mr-2" />
              Push bildirishnomalariga obunalik faol
            </div>
          )}
        </CardContent>
      </Card>

      {/* Supported Features */}
      <Card className="glass-card animate-slideIn">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            PWA Xususiyatlari
          </CardTitle>
          <CardDescription>Qo'llab-quvvatlanuvchi imkoniyatlar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm">Manifest fayli va offline qo'llab-quvatlanish</span>
            </div>
            {isPushSupported ? (
              <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm">Web Push API</span>
              </div>
            ) : (
              <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-sm">Push API (cheklangan)</span>
              </div>
            )}
            <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm">HTTPS va offline qo'llab-quvatlanish</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
