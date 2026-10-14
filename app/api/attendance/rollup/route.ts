import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export async function POST(request: NextRequest) {
  try {
    // Verify this is a cron call (Vercel sets this header)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    // In production, verify the cron secret. In dev, allow all.
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const now = new Date()
    const today = now.toISOString().split("T")[0]

    // Step 1: Auto-close stale sessions (open for > 14 hours)
    const staleThreshold = new Date(now.getTime() - 14 * 60 * 60 * 1000).toISOString()

    const { data: staleSessions } = await admin
      .from("attendance_sessions")
      .select("id, employee_id, started_at")
      .is("ended_at", null)
      .lt("started_at", staleThreshold)

    if (staleSessions?.length) {
      // Close all stale sessions
      const staleIds = staleSessions.map((s) => s.id)
      await admin
        .from("attendance_sessions")
        .update({
          ended_at: now.toISOString(),
          end_reason: "auto_eod",
        })
        .in("id", staleIds)
    }

    // Step 2: Get all employees who had sessions today
    const { data: todaySessions } = await admin
      .from("attendance_sessions")
      .select("employee_id")
      .gte("started_at", `${today}T00:00:00.000Z`)
      .lte("started_at", `${today}T23:59:59.999Z`)

    if (!todaySessions?.length) {
      return NextResponse.json({ message: "No sessions to rollup", closedStale: staleSessions?.length || 0 })
    }

    // Unique employee IDs
    const employeeIds = [...new Set(todaySessions.map((s) => s.employee_id))]

    // Step 3: Recompute daily for each employee
    const results = await Promise.allSettled(
      employeeIds.map((empId) =>
        admin.rpc("recompute_daily", {
          p_employee_id: empId,
          p_date: today,
        })
      )
    )

    const succeeded = results.filter((r) => r.status === "fulfilled").length
    const failed = results.filter((r) => r.status === "rejected").length

    return NextResponse.json({
      message: "Rollup complete",
      closedStale: staleSessions?.length || 0,
      recomputed: succeeded,
      failed,
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
