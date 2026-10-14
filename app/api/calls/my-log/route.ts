import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/calls/my-log?date=YYYY-MM-DD
 * Returns the authenticated employee's call logs for a given date.
 * Used by the dialer's call log view.
 *
 * Query params:
 *   date - required, ISO date string (YYYY-MM-DD)
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get("date")

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "date query parameter is required (YYYY-MM-DD)" },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    const dayStart = `${date}T00:00:00.000Z`
    const dayEnd = `${date}T23:59:59.999Z`

    const { data: calls, error: callsError } = await admin
      .from("call_logs")
      .select("id, client_number, direction, duration_seconds, call_started_at, ingest_source, lead_id")
      .eq("employee_id", caller.employeeId)
      .gte("call_started_at", dayStart)
      .lte("call_started_at", dayEnd)
      .order("call_started_at", { ascending: false })

    if (callsError) throw callsError

    const { data: daily } = await admin
      .from("call_daily")
      .select("total_calls, inbound_calls, outbound_calls, missed_calls, total_duration_seconds, connected_calls")
      .eq("employee_id", caller.employeeId)
      .eq("date", date)
      .single()

    return NextResponse.json({
      calls: calls ?? [],
      summary: daily ?? null,
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
