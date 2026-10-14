import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { toCsv, csvResponseHeaders } from "@/lib/attendance/csv"

/**
 * GET /api/attendance/export?month=YYYY-MM
 * Admin/HR only. Monthly hours CSV handed to whoever runs payroll
 * externally. Contains NO salary, rate, or monetary field.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const month = request.nextUrl.searchParams.get("month") // YYYY-MM
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json(
      { error: "month query param required as YYYY-MM" },
      { status: 400 }
    )
  }

  // [start, end) covering the calendar month
  const start = `${month}-01`
  const [y, m] = month.split("-").map(Number)
  const end = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`

  const admin = getSupabaseAdmin()

  // Org employees (names) + their daily rollups for the month
  const [{ data: employees }, { data: daily }] = await Promise.all([
    admin
      .from("fs_employees")
      .select("id, full_name")
      .eq("org_id", caller.orgId),
    admin
      .from("attendance_daily")
      .select("employee_id, date, active_minutes, idle_minutes, utilisation, status, auto_closed, flags")
      .gte("date", start)
      .lt("date", end),
  ])

  const nameById = new Map((employees ?? []).map((e) => [e.id, e.full_name]))
  const orgEmployeeIds = new Set((employees ?? []).map((e) => e.id))

  // Aggregate per employee (only org members; mid-month joiners/leavers
  // simply have fewer daily rows, which is handled naturally).
  type Agg = {
    daysPresent: number
    attendedMin: number
    activeMin: number
    utilSum: number
    utilDays: number
    autoClosed: number
    flagged: number
  }
  const agg = new Map<string, Agg>()
  for (const d of daily ?? []) {
    if (!orgEmployeeIds.has(d.employee_id)) continue
    const a =
      agg.get(d.employee_id) ??
      { daysPresent: 0, attendedMin: 0, activeMin: 0, utilSum: 0, utilDays: 0, autoClosed: 0, flagged: 0 }
    const active = d.active_minutes ?? 0
    const idle = d.idle_minutes ?? 0
    const flags: string[] = d.flags ?? []
    const isPreTracking = flags.includes("pre_tracking")

    if (d.status && d.status !== "absent") a.daysPresent += 1
    a.attendedMin += active + idle
    a.activeMin += active
    if (!isPreTracking) {
      a.utilSum += Number(d.utilisation ?? 0)
      a.utilDays += 1
    }
    if (d.auto_closed) a.autoClosed += 1
    if (flags.length > 0) a.flagged += 1
    agg.set(d.employee_id, a)
  }

  const hrs = (min: number) => (min / 60).toFixed(2)
  const rows = [...agg.entries()]
    .map(([id, a]) => [
      id,
      nameById.get(id) ?? "",
      a.daysPresent,
      hrs(a.attendedMin),
      hrs(a.activeMin),
      a.utilDays ? (a.utilSum / a.utilDays).toFixed(1) : "0.0",
      a.autoClosed,
      a.flagged,
    ])
    .sort((x, y) => String(x[1]).localeCompare(String(y[1])))

  const csv = toCsv(
    [
      "Employee ID",
      "Name",
      "Days Present",
      "Attended Hours",
      "Active Hours",
      "Utilisation %",
      "Days Auto-Closed",
      "Days Flagged",
    ],
    rows
  )

  return new NextResponse(csv, { headers: csvResponseHeaders(`attendance-${month}.csv`) })
}
