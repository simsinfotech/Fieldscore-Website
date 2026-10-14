import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { toCsv, csvResponseHeaders } from "@/lib/attendance/csv"

/**
 * GET /api/attendance/me/export
 * DPDP right-of-access: the caller's own full attendance & activity
 * history as CSV (one row per day).
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data: daily } = await admin
    .from("attendance_daily")
    .select("date, first_check_in, last_check_out, session_count, active_minutes, idle_minutes, work_hours, utilisation, status, auto_closed, flags")
    .eq("employee_id", caller.employeeId)
    .order("date", { ascending: false })

  const rows = (daily ?? []).map((d) => {
    const active = d.active_minutes ?? 0
    const idle = d.idle_minutes ?? 0
    return [
      d.date,
      d.first_check_in ?? "",
      d.last_check_out ?? "",
      d.session_count ?? 0,
      ((active + idle) / 60).toFixed(2),
      (active / 60).toFixed(2),
      (idle / 60).toFixed(2),
      Number(d.utilisation ?? 0).toFixed(1),
      d.status ?? "",
      d.auto_closed ? "yes" : "no",
      (d.flags ?? []).join("; "),
    ]
  })

  const csv = toCsv(
    [
      "Date",
      "First Check-in",
      "Last Check-out",
      "Sessions",
      "Attended Hours",
      "Active Hours",
      "Away Hours",
      "Utilisation %",
      "Status",
      "Auto-Closed",
      "Flags",
    ],
    rows
  )

  return new NextResponse(csv, {
    headers: csvResponseHeaders(`my-attendance-${caller.employeeId}.csv`),
  })
}
