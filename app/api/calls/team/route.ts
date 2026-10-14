import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/calls/team?date=YYYY-MM-DD
 * Admin/manager dashboard data — per-employee call stats from call_daily,
 * plus device health info (last heartbeat, stale flag).
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!caller.isAdmin && caller.role !== "manager" && caller.role !== "sales_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = getSupabaseAdmin()
    const dateParam = request.nextUrl.searchParams.get("date")
    const date =
      dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
        ? dateParam
        : new Date().toISOString().split("T")[0]
    const detailEmployeeId = request.nextUrl.searchParams.get("employeeId")
    const wantsDetail = request.nextUrl.searchParams.get("detail") === "true"

    // Detail mode: return individual call_logs for a specific employee/date
    if (wantsDetail && detailEmployeeId) {
      const dayStart = `${date}T00:00:00.000Z`
      const dayEnd = `${date}T23:59:59.999Z`

      // Verify the caller can see this employee
      const { data: emp } = await admin
        .from("fs_employees")
        .select("id")
        .eq("id", detailEmployeeId)
        .eq("org_id", caller.orgId)
        .maybeSingle()

      if (!emp) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }

      if (!caller.isAdmin && caller.role === "manager") {
        const { data: subtree } = await admin.rpc("subtree_ids", {
          p_root: caller.employeeId,
        })
        const ids = (subtree ?? []).map((s: { id: string }) => s.id)
        if (!ids.includes(detailEmployeeId)) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }

      const { data: calls } = await admin
        .from("call_logs")
        .select("id, client_number, direction, duration_seconds, call_started_at, lead_id, recording_url, disposition, transcript:call_transcripts!call_transcripts_call_id_fkey(summary), ai_analysis:ai_analyses!ai_analyses_call_id_fkey(summary, sentiment, coaching, signals, next_action)")
        .eq("employee_id", detailEmployeeId)
        .gte("call_started_at", dayStart)
        .lte("call_started_at", dayEnd)
        .order("call_started_at", { ascending: true })

      return NextResponse.json({ calls: calls ?? [] })
    }

    // Resolve visible employee set
    let employeeQuery = admin
      .from("fs_employees")
      .select("id, full_name, designation, avatar_url")
      .eq("org_id", caller.orgId)
      .eq("is_active", true)

    if (!caller.isAdmin && caller.role === "manager") {
      const { data: subtree } = await admin.rpc("subtree_ids", {
        p_root: caller.employeeId,
      })
      const ids = (subtree ?? []).map((s: { id: string }) => s.id)
      const reportIds = ids.filter((id: string) => id !== caller.employeeId)
      if (reportIds.length === 0) return NextResponse.json({ date, team: [] })
      employeeQuery = employeeQuery.in("id", reportIds)
    }

    const { data: employees } = await employeeQuery
    if (!employees?.length) {
      return NextResponse.json({ date, team: [] })
    }

    const employeeIds = employees.map((e) => e.id)

    const [dailyRes, devicesRes] = await Promise.all([
      admin
        .from("call_daily")
        .select("*")
        .in("employee_id", employeeIds)
        .eq("date", date),
      admin
        .from("call_devices")
        .select("employee_id, device_name, app_version, last_heartbeat_at, is_active")
        .in("employee_id", employeeIds)
        .eq("is_active", true),
    ])

    const dailyRows = dailyRes.data ?? []
    const deviceRows = devicesRes.data ?? []

    const now = new Date()

    const team = employees.map((emp) => {
      const daily = dailyRows.find((d) => d.employee_id === emp.id)
      const device = deviceRows.find((d) => d.employee_id === emp.id)

      // Device is stale if no heartbeat in > 2 hours during work hours (9AM-8PM IST)
      let deviceStale = false
      if (device?.last_heartbeat_at) {
        const lastBeat = new Date(device.last_heartbeat_at)
        const diffMs = now.getTime() - lastBeat.getTime()
        const hoursSinceHeartbeat = diffMs / (1000 * 60 * 60)

        // Check if current time is within IST work hours (9AM–8PM)
        const istHour = new Date(
          now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
        ).getHours()
        const isWorkHours = istHour >= 9 && istHour < 20

        if (hoursSinceHeartbeat > 2 && isWorkHours) {
          deviceStale = true
        }
      }

      return {
        ...emp,
        total_calls: daily?.total_calls ?? 0,
        inbound_calls: daily?.inbound_calls ?? 0,
        outbound_calls: daily?.outbound_calls ?? 0,
        missed_calls: daily?.missed_calls ?? 0,
        total_duration_seconds: daily?.total_duration_seconds ?? 0,
        avg_duration_seconds: daily?.avg_duration_seconds ?? 0,
        first_call_at: daily?.first_call_at ?? null,
        last_call_at: daily?.last_call_at ?? null,
        calling_window_minutes: daily?.calling_window_minutes ?? 0,
        unique_numbers: daily?.unique_numbers ?? 0,
        connected_calls: daily?.connected_calls ?? 0,
        device_name: device?.device_name ?? null,
        app_version: device?.app_version ?? null,
        last_heartbeat_at: device?.last_heartbeat_at ?? null,
        device_stale: deviceStale,
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
