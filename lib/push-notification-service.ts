import webpush from "web-push"
import { createClient } from "@/lib/supabase/server"

let webPushInitialized = false

export function initWebPush(): boolean {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY

    if (!publicKey || !privateKey) {
      console.warn("[PUSH] VAPID keys not configured. Skipping web-push initialization.")
      return false
    }

    webpush.setVapidDetails("mailto:sherdormebel@example.com", publicKey, privateKey)

    webPushInitialized = true
    console.log("[PUSH] Web-push initialized successfully")
    return true
  } catch (error) {
    console.error("[PUSH] Failed to initialize web-push:", error)
    return false
  }
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  vibrate?: number[]
  tag?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string; icon?: string }>
  data?: Record<string, any>
}

export interface SendPushResult {
  success: number
  failed: number
  errors: Array<{ endpoint: string; error: string }>
}

const sentNotifications = new Map<string, number>()
const DUPLICATE_CHECK_WINDOW = 5 * 60 * 1000

function shouldSendNotification(tag: string): boolean {
  const lastSent = sentNotifications.get(tag)
  const now = Date.now()

  if (lastSent && now - lastSent < DUPLICATE_CHECK_WINDOW) {
    console.log(`[PUSH] Skipping duplicate notification: ${tag}`)
    return false
  }

  sentNotifications.set(tag, now)
  return true
}

export async function sendPushNotificationToAll(payload: PushNotificationPayload): Promise<SendPushResult> {
  if (!webPushInitialized) {
    initWebPush()
  }

  const supabase = await createClient()
  const result: SendPushResult = { success: 0, failed: 0, errors: [] }

  const notificationTag = payload.tag || `notification-${Date.now()}`
  if (!shouldSendNotification(notificationTag)) {
    console.log("[PUSH] Notification skipped (duplicate within 5 minutes)")
    return { success: 0, failed: 0, errors: [] }
  }

  try {
    const { data: subscriptions, error } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false })

    if (error || !subscriptions) {
      console.error("[PUSH] Failed to fetch subscriptions:", error)
      return result
    }

    console.log(`[PUSH] Sending notification to ${subscriptions.length} active devices`, {
      tag: notificationTag,
      title: payload.title,
    })

    const notification: PushNotificationPayload = {
      title: payload.title,
      body: payload.body,
      icon: payload.icon || "/icon-192.jpg",
      badge: payload.badge || "/icon-192.jpg",
      vibrate: payload.vibrate || [100, 50, 100],
      tag: notificationTag,
      requireInteraction: payload.requireInteraction ?? true,
      data: {
        dateOfArrival: Date.now(),
        ...payload.data,
      },
      actions: payload.actions || [
        { action: "explore", title: "Ko'rish" },
        { action: "close", title: "Yopish" },
      ],
    }

    for (const subscription of subscriptions) {
      try {
        const subscriptionObject = {
          endpoint: subscription.endpoint,
          keys: {
            auth: subscription.auth,
            p256dh: subscription.p256dh,
          },
        }

        let payloadToSend = notification
        if (subscription.platform === "ios") {
          payloadToSend = {
            ...notification,
            actions: undefined,
          }
        }

        await webpush.sendNotification(subscriptionObject, JSON.stringify(payloadToSend))

        await supabase.from("notification_logs").insert({
          subscription_id: subscription.id,
          title: notification.title,
          body: notification.body,
          icon: notification.icon,
          status: "sent",
          platform: subscription.platform || "unknown",
          sent_at: new Date().toISOString(),
        })

        result.success++
        console.log(`[PUSH] Sent to ${subscription.endpoint.slice(0, 30)}... (${subscription.platform})`)
      } catch (error: any) {
        result.failed++

        if (error.statusCode === 410 || error.statusCode === 404) {
          await supabase.from("push_subscriptions").update({ is_active: false }).eq("id", subscription.id)
          console.warn(`[PUSH] Marked subscription as inactive (${error.statusCode})`)
        } else if (error.statusCode === 429) {
          console.warn("[PUSH] Rate limited by push service")
        }

        await supabase.from("notification_logs").insert({
          subscription_id: subscription.id,
          title: notification.title,
          body: notification.body,
          icon: notification.icon,
          status: "failed",
          platform: subscription.platform || "unknown",
          error_message: error.message,
          sent_at: new Date().toISOString(),
        })

        result.errors.push({
          endpoint: subscription.endpoint.slice(0, 50),
          error: error.message,
        })

        console.error(`[PUSH] Failed to send:`, error.message)
      }
    }
  } catch (error) {
    console.error("[PUSH] Error in sendPushNotificationToAll:", error)
  }

  return result
}
