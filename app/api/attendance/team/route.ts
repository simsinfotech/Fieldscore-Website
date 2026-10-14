import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/attendance/team?date=YYYY-MM-DD
 * Admin/HR see the whole org; managers see only their subtree. (T-08)
 * Returns per-employee activity with flags, utilisation and idle split.
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Managers, admins and HR only.
    if (!caller.isAdmin && caller.role !== "manager") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = getSupabaseAdmin()
    const dateParam = request.nextUrl.searchParams.get("date")
    const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
      ? dateParam
      : new Date().toISOString().split("T")[0]
    const dayStart = `${date}T00:00:00.000Z`
    const dayEnd = `${date}T23:59:59.999Z`

    // Resolve the visible employee set: managers see their subtree only.
    let employeeQuery = admin
      .from("fs_employees")
      .select("id, full_name, designation, department, avatar_url")
      .eq("org_id", caller.orgId)
      .eq("is_active", true)

    if (!caller.isAdmin && caller.role === "manager") {
      const { data: subtree } = await admin.rpc("subtree_ids", {
        p_root: caller.employeeId,
      })
      const ids = (subtree ?? []).map((s: { id: string }) => s.id)
      // Exclude the manager themselves from their team roster.
      const reportIds = ids.filter((id: string) => id !== caller.employeeId)
      if (reportIds.length === 0) return NextResponse.json({ date, team: [] })
      employeeQuery = employeeQuery.in("id", reportIds)
    }

    const { data: employees } = await employeeQuery
    if (!employees?.length) {
      return NextResponse.json({ date, team: [] })
    }

    const employeeIds = employees.map((e) => e.id)

    const [sessionsRes, dailyRes, minutesRes] = await Promise.all([
      admin
        .from("attendance_sessions")
        .select("employee_id, started_at, ended_at")
        .in("employee_id", employeeIds)
        .gte("started_at", dayStart)
        .lte("started_at", dayEnd),
      admin
        .from("attendance_daily")
        .select("employee_id, active_minutes, idle_minutes, work_hours, utilisation, status, flags, auto_closed")
        .in("employee_id", employeeIds)
        .eq("date", date),
      admin
        .from("activity_minutes")
        .select("employee_id, bucket")
        .in("employee_id", employeeIds)
        .gte("bucket", dayStart)
        .lte("bucket", dayEnd)
        .order("bucket", { ascending: true })
        .limit(20000),
    ])

    const sessions = sessionsRes.data || []
    const dailyRows = dailyRes.data || []

    const bucketsByEmployee = new Map<string, string[]>()
    for (const m of minutesRes.data || []) {
      const arr = bucketsByEmployee.get(m.employee_id) || []
      arr.push(m.bucket)
      bucketsByEmployee.set(m.employee_id, arr)
    }

    const now = Date.now()

    const team = employees.map((emp) => {
      const empSessions = sessions.filter((s) => s.employee_id === emp.id)
      const hasOpenSession = empSessions.some((s) => !s.ended_at)
      const daily = dailyRows.find((d) => d.employee_id === emp.id)
      const empBuckets = bucketsByEmployee.get(emp.id) || []

      let liveStatus: "online" | "offline" | "checked_out" = "offline"
      if (hasOpenSession) liveStatus = "online"
      else if (empSessions.length > 0) liveStatus = "checked_out"

      let activeMinutes: number
      let idleMinutes: number
      let workHours: number
      let status: string
      let flags: string[]
      let autoClosed: boolean

      if (daily && empSessions.length === 0) {
        // Daily rollup exists but no sessions — use stored values.
        activeMinutes = daily.active_minutes || 0
        idleMinutes = daily.idle_minutes || 0
        workHours = daily.work_hours || 0
        status = daily.status || "absent"
        flags = (daily.flags as string[]) || []
        autoClosed = daily.auto_closed || false
      } else if (empSessions.length > 0) {
        // Compute from check-in to check-out span.
        const firstIn = Math.min(...empSessions.map((s) => new Date(s.started_at).getTime()))
        const lastOut = hasOpenSession
          ? now
          : Math.max(...empSessions.map((s) => new Date(s.ended_at!).getTime()))
        const spanMinutes = Math.round((lastOut - firstIn) / 60_000)

        // active = actual activity buckets (each bucket = 1 min of screen activity)
        // idle = total span minus active buckets
        const activeBucketCount = empBuckets.length
        activeMinutes = spanMinutes
        idleMinutes = Math.max(0, spanMinutes - activeBucketCount)

        workHours = Math.round((spanMinutes / 60) * 100) / 100

        if (daily) {
          status = daily.status || "absent"
          flags = (daily.flags as string[]) || []
          autoClosed = daily.auto_closed || false
        } else {
          // Determine status from first check-in time (IST)
          const firstInDate = new Date(firstIn)
          const istHour = Number(
            new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(firstInDate)
          )
          if (workHours < 4) status = "half_day"
          else if (istHour >= 10) status = "late"
          else status = "present"

          flags = []
          if (empBuckets.length === 0 && spanMinutes > 0) flags.push("no_activity")
          autoClosed = false
        }
      } else {
        // No sessions at all — absent.
        activeMinutes = 0
        idleMinutes = 0
        workHours = 0
        status = "absent"
        flags = []
        autoClosed = false
      }

      return {
        ...emp,
        liveStatus,
        activeMinutes,
        idleMinutes,
        workHours,
        status,
        flags,
        autoClosed,
        sessionCount: empSessions.length,
        buckets: empBuckets,
      }
    })

    return NextResponse.json({ date, team })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
