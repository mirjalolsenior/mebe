import { createClient } from "@/lib/supabase/server"
import { sendPushNotificationToAll } from "./push-notification-service"

/**
 * Server-side push notification scheduler
 * Updated to run ONCE DAILY (8 AM) for Vercel Hobby plan compatibility
 * Checks for orders & inventory changes since last run
 */

export interface SchedulerResult {
  success: boolean
  ordersToday: number
  ordersTomorrow: number
  ordersOverdue: number
  lowStockItems: number
  outOfStockItems: number
  notificationsSent: number
  errors: string[]
}

export async function runPushNotificationScheduler(): Promise<SchedulerResult> {
  console.log("[PUSH SCHEDULER] Starting scheduled notification check at", new Date().toISOString())

  const result: SchedulerResult = {
    success: true,
    ordersToday: 0,
    ordersTomorrow: 0,
    ordersOverdue: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    notificationsSent: 0,
    errors: [],
  }

  const supabase = await createClient()

  try {
    // Check order deadlines
    const { ordersToday, ordersTomorrow, ordersOverdue } = await checkAndNotifyOrderDeadlines(supabase)
    result.ordersToday = ordersToday
    result.ordersTomorrow = ordersTomorrow
    result.ordersOverdue = ordersOverdue

    // Check inventory levels
    const { lowStock, outOfStock } = await checkAndNotifyInventory(supabase)
    result.lowStockItems = lowStock
    result.outOfStockItems = outOfStock

    result.notificationsSent =
      ordersToday + ordersTomorrow + ordersOverdue + (lowStock > 0 ? 1 : 0) + (outOfStock > 0 ? 1 : 0)

    console.log("[PUSH SCHEDULER] Completed successfully", {
      ordersToday,
      ordersTomorrow,
      ordersOverdue,
      lowStock,
      outOfStock,
      notificationsSent: result.notificationsSent,
    })

    // Log the execution
    await supabase.from("push_scheduler_logs").insert({
      ran_at: new Date().toISOString(),
      orders_today: ordersToday,
      orders_tomorrow: ordersTomorrow,
      orders_overdue: ordersOverdue,
      low_stock_items: lowStock,
      out_of_stock_items: outOfStock,
      notifications_sent: result.notificationsSent,
      status: "completed",
    })
  } catch (error) {
    result.success = false
    const errorMsg = error instanceof Error ? error.message : "Unknown error"
    result.errors.push(errorMsg)
    console.error("[PUSH SCHEDULER] Error:", errorMsg)

    await supabase.from("push_scheduler_logs").insert({
      ran_at: new Date().toISOString(),
      notifications_sent: 0,
      status: "failed",
      error_message: errorMsg,
    })
  }

  return result
}

/**
 * Check orders and send notifications for:
 * - Today's deliveries
 * - Tomorrow's deliveries
 * - Overdue orders (delivery_date < today AND status != completed)
 * Improved to handle daily execution by checking notification flags
 */
async function checkAndNotifyOrderDeadlines(
  supabase: any,
): Promise<{ ordersToday: number; ordersTomorrow: number; ordersOverdue: number }> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  try {
    // Fetch all active orders with pending notifications
    const { data: orders, error } = await supabase
      .from("zakazlar")
      .select("id, qachon_berish_kerak, status, notified_today, notified_tomorrow, notified_overdue")
      .not("qachon_berish_kerak", "is", null)
      .not("status", "is", null)

    if (error) {
      throw new Error(`Failed to fetch orders: ${error.message}`)
    }

    if (!orders || orders.length === 0) {
      console.log("[PUSH SCHEDULER] No orders found")
      return { ordersToday: 0, ordersTomorrow: 0, ordersOverdue: 0 }
    }

    const dueTodayOrders = orders.filter((order) => {
      const deliveryDate = new Date(order.qachon_berish_kerak)
      deliveryDate.setHours(0, 0, 0, 0)
      return deliveryDate.getTime() === today.getTime() && order.status !== "completed" && !order.notified_today
    })

    const dueTomorrowOrders = orders.filter((order) => {
      const deliveryDate = new Date(order.qachon_berish_kerak)
      deliveryDate.setHours(0, 0, 0, 0)
      return deliveryDate.getTime() === tomorrow.getTime() && order.status !== "completed" && !order.notified_tomorrow
    })

    const overdueOrders = orders.filter((order) => {
      const deliveryDate = new Date(order.qachon_berish_kerak)
      deliveryDate.setHours(0, 0, 0, 0)
      return deliveryDate.getTime() < today.getTime() && order.status !== "completed" && !order.notified_overdue
    })

    // Send notifications and track them
    if (dueTodayOrders.length > 0) {
      await sendPushNotificationToAll({
        title: "⏰ Bugun yetkazish kerak!",
        body: `${dueTodayOrders.length} ta zakaz bugun yetkazilishi kerak.`,
        tag: `delivery-today-${today.toISOString().split("T")[0]}`,
        data: {
          type: "order_today",
          count: dueTodayOrders.length,
        },
      })

      // Mark as notified
      const { error: updateError } = await supabase
        .from("zakazlar")
        .update({ notified_today: true })
        .in(
          "id",
          dueTodayOrders.map((o) => o.id),
        )

      if (updateError) {
        console.error("[PUSH SCHEDULER] Failed to mark orders as notified:", updateError)
      }

      console.log(`[PUSH SCHEDULER] Sent notification for ${dueTodayOrders.length} orders due today`)
    }

    if (dueTomorrowOrders.length > 0) {
      await sendPushNotificationToAll({
        title: "📅 Ertaga yetkazish kerak",
        body: `${dueTomorrowOrders.length} ta zakaz ertaga yetkazilishi kerak.`,
        tag: `delivery-tomorrow-${tomorrow.toISOString().split("T")[0]}`,
        data: {
          type: "order_tomorrow",
          count: dueTomorrowOrders.length,
        },
      })

      const { error: updateError } = await supabase
        .from("zakazlar")
        .update({ notified_tomorrow: true })
        .in(
          "id",
          dueTomorrowOrders.map((o) => o.id),
        )

      if (updateError) {
        console.error("[PUSH SCHEDULER] Failed to mark orders as notified:", updateError)
      }

      console.log(`[PUSH SCHEDULER] Sent notification for ${dueTomorrowOrders.length} orders due tomorrow`)
    }

    if (overdueOrders.length > 0) {
      await sendPushNotificationToAll({
        title: "🚨 Kechikkan zakazlar!",
        body: `${overdueOrders.length} ta zakaz muddati o'tib ketgan.`,
        tag: `delivery-overdue-${today.toISOString().split("T")[0]}`,
        data: {
          type: "order_overdue",
          count: overdueOrders.length,
        },
      })

      const { error: updateError } = await supabase
        .from("zakazlar")
        .update({ notified_overdue: true })
        .in(
          "id",
          overdueOrders.map((o) => o.id),
        )

      if (updateError) {
        console.error("[PUSH SCHEDULER] Failed to mark orders as notified:", updateError)
      }

      console.log(`[PUSH SCHEDULER] Sent notification for ${overdueOrders.length} overdue orders`)
    }

    return {
      ordersToday: dueTodayOrders.length,
      ordersTomorrow: dueTomorrowOrders.length,
      ordersOverdue: overdueOrders.length,
    }
  } catch (error) {
    console.error("[PUSH SCHEDULER] Error in checkAndNotifyOrderDeadlines:", error)
    throw error
  }
}

/**
 * Check inventory levels and send notifications for:
 * - Low stock (quantity <= 10 AND > 0)
 * - Out of stock (quantity = 0)
 * Enhanced to reset daily flags for items that recover stock
 */
async function checkAndNotifyInventory(
  supabase: any,
  lowStockThreshold = 10,
): Promise<{ lowStock: number; outOfStock: number }> {
  try {
    // Fetch all inventory items
    const { data: items, error } = await supabase
      .from("ombor")
      .select("id, nomi, qoldiq, out_of_stock_notified, low_stock_notified")

    if (error) {
      throw new Error(`Failed to fetch inventory: ${error.message}`)
    }

    if (!items || items.length === 0) {
      console.log("[PUSH SCHEDULER] No inventory items found")
      return { lowStock: 0, outOfStock: 0 }
    }

    const recoveredOutOfStock = items.filter((item) => item.qoldiq > 0 && item.out_of_stock_notified)
    const recoveredLowStock = items.filter((item) => item.qoldiq > lowStockThreshold && item.low_stock_notified)

    if (recoveredOutOfStock.length > 0) {
      await supabase
        .from("ombor")
        .update({ out_of_stock_notified: false })
        .in(
          "id",
          recoveredOutOfStock.map((i) => i.id),
        )
      console.log(`[PUSH SCHEDULER] Reset out-of-stock flag for ${recoveredOutOfStock.length} items`)
    }

    if (recoveredLowStock.length > 0) {
      await supabase
        .from("ombor")
        .update({ low_stock_notified: false })
        .in(
          "id",
          recoveredLowStock.map((i) => i.id),
        )
      console.log(`[PUSH SCHEDULER] Reset low-stock flag for ${recoveredLowStock.length} items`)
    }

    const outOfStockItems = items.filter((item) => item.qoldiq === 0 && !item.out_of_stock_notified)

    const lowStockItems = items.filter(
      (item) => item.qoldiq > 0 && item.qoldiq <= lowStockThreshold && !item.low_stock_notified,
    )

    // Send out of stock notification
    if (outOfStockItems.length > 0) {
      await sendPushNotificationToAll({
        title: "❌ Tovarlar tugadi!",
        body: `${outOfStockItems.length} ta tovar omborda tugagan.`,
        tag: `inventory-out-of-stock-${new Date().toISOString().split("T")[0]}`,
        data: {
          type: "out_of_stock",
          count: outOfStockItems.length,
          items: outOfStockItems.slice(0, 3).map((i) => i.nomi),
        },
      })

      // Mark as notified
      const { error: updateError } = await supabase
        .from("ombor")
        .update({ out_of_stock_notified: true })
        .in(
          "id",
          outOfStockItems.map((i) => i.id),
        )

      if (updateError) {
        console.error("[PUSH SCHEDULER] Failed to mark out-of-stock items:", updateError)
      }

      console.log(`[PUSH SCHEDULER] Sent notification for ${outOfStockItems.length} out-of-stock items`)
    }

    // Send low stock notification
    if (lowStockItems.length > 0) {
      await sendPushNotificationToAll({
        title: "⚠️ Kam qolgan tovarlar",
        body: `${lowStockItems.length} ta tovar omborda kam qolgan.`,
        tag: `inventory-low-stock-${new Date().toISOString().split("T")[0]}`,
        data: {
          type: "low_stock",
          count: lowStockItems.length,
          items: lowStockItems.slice(0, 3).map((i) => i.nomi),
        },
      })

      // Mark as notified
      const { error: updateError } = await supabase
        .from("ombor")
        .update({ low_stock_notified: true })
        .in(
          "id",
          lowStockItems.map((i) => i.id),
        )

      if (updateError) {
        console.error("[PUSH SCHEDULER] Failed to mark low-stock items:", updateError)
      }

      console.log(`[PUSH SCHEDULER] Sent notification for ${lowStockItems.length} low-stock items`)
    }

    return {
      outOfStock: outOfStockItems.length,
      lowStock: lowStockItems.length,
    }
  } catch (error) {
    console.error("[PUSH SCHEDULER] Error in checkAndNotifyInventory:", error)
    throw error
  }
}
