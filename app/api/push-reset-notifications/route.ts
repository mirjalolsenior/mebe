import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Admin endpoint to reset notification state for testing
 * DANGEROUS: Only use in development or with explicit authorization
 */
export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization")
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()

    // Reset order notification flags
    const { error: orderError } = await supabase
      .from("zakazlar")
      .update({
        notified_today: false,
        notified_tomorrow: false,
        notified_overdue: false,
      })
      .eq("status", "null")
      .or("status.neq.completed")

    // Reset inventory notification flags
    const { error: invError } = await supabase.from("ombor").update({
      low_stock_notified: false,
      out_of_stock_notified: false,
    })

    if (orderError || invError) {
      throw new Error(`Failed to reset: ${orderError?.message || ""} ${invError?.message || ""}`.trim())
    }

    return NextResponse.json(
      {
        success: true,
        message: "Notification state reset successfully",
        timestamp: new Date().toISOString(),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("[PUSH RESET] Error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
