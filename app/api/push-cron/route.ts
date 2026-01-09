import { NextResponse } from "next/server"
import { runPushNotificationScheduler } from "@/lib/push-scheduler-service"

export const maxDuration = 60

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[PUSH CRON] Starting scheduled notification check at", new Date().toISOString())
    const startTime = Date.now()

    const result = await runPushNotificationScheduler()

    const duration = Date.now() - startTime

    return NextResponse.json(
      {
        success: result.success,
        message: "Notification scheduler completed",
        duration: `${duration}ms`,
        summary: {
          ordersToday: result.ordersToday,
          ordersTomorrow: result.ordersTomorrow,
          ordersOverdue: result.ordersOverdue,
          lowStockItems: result.lowStockItems,
          outOfStockItems: result.outOfStockItems,
          notificationsSent: result.notificationsSent,
        },
        errors: result.errors,
        timestamp: new Date().toISOString(),
      },
      { status: result.success ? 200 : 500 },
    )
  } catch (error) {
    console.error("[PUSH CRON] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

export async function HEAD() {
  return NextResponse.json({ status: "ok" })
}
