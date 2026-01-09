import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Debug endpoint for monitoring push notification system health
 * Returns subscription status, recent logs, and system state
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Verify debug access (use same secret as cron)
    const authHeader = request.headers.get("authorization")
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get subscription statistics
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("id, platform, is_active, created_at, last_verified")

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`)
    }

    const activeCount = subscriptions?.filter((s) => s.is_active).length || 0
    const inactiveCount = subscriptions?.filter((s) => !s.is_active).length || 0

    const platformStats = {
      ios: subscriptions?.filter((s) => s.platform === "ios" && s.is_active).length || 0,
      android: subscriptions?.filter((s) => s.platform === "android" && s.is_active).length || 0,
      web: subscriptions?.filter((s) => s.platform === "web" && s.is_active).length || 0,
    }

    // Get recent notification logs
    const { data: recentLogs, error: logsError } = await supabase
      .from("notification_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)

    if (logsError) {
      throw new Error(`Failed to fetch logs: ${logsError.message}`)
    }

    // Get recent scheduler logs
    const { data: schedulerLogs, error: schedError } = await supabase
      .from("push_scheduler_logs")
      .select("*")
      .order("ran_at", { ascending: false })
      .limit(10)

    if (schedError) {
      throw new Error(`Failed to fetch scheduler logs: ${schedError.message}`)
    }

    // Get current order and inventory status
    const { data: orders, error: orderError } = await supabase
      .from("zakazlar")
      .select("id, notified_today, notified_tomorrow, notified_overdue")

    const { data: inventory, error: invError } = await supabase
      .from("ombor")
      .select("id, low_stock_notified, out_of_stock_notified")

    const notificationState = {
      orders: {
        total: orders?.length || 0,
        notifiedToday: orders?.filter((o) => o.notified_today).length || 0,
        notifiedTomorrow: orders?.filter((o) => o.notified_tomorrow).length || 0,
        notifiedOverdue: orders?.filter((o) => o.notified_overdue).length || 0,
      },
      inventory: {
        total: inventory?.length || 0,
        lowStockNotified: inventory?.filter((i) => i.low_stock_notified).length || 0,
        outOfStockNotified: inventory?.filter((i) => i.out_of_stock_notified).length || 0,
      },
    }

    return NextResponse.json(
      {
        timestamp: new Date().toISOString(),
        subscriptions: {
          total: subscriptions?.length || 0,
          active: activeCount,
          inactive: inactiveCount,
          byPlatform: platformStats,
        },
        notificationState,
        recentLogs: recentLogs?.slice(0, 10),
        schedulerLogs: schedulerLogs?.slice(0, 5),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[PUSH DEBUG] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
