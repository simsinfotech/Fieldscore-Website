import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/calls/device-health
 * Admin-only: lists all registered devices with last heartbeat,
 * flags devices silent for >2h during work hours (9AM–8PM IST).
 */
export async function GET() {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!caller.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const admin = getSupabaseAdmin()

    const { data: devices, error } = await admin
      .from("call_devices")
      .select(
        "id, device_id, device_name, os_version, app_version, last_heartbeat_at, is_active, created_at, employee_id"
      )
      .eq("org_id", caller.orgId)
      .order("last_heartbeat_at", { ascending: false, nullsFirst: false })

    if (error) throw error

    // Look up employee names
    const employeeIds = [
      ...new Set((devices ?? []).map((d) => d.employee_id)),
    ]
    const { data: employees } = await admin
      .from("fs_employees")
      .select("id, full_name")
      .in("id", employeeIds)

    const empMap = new Map<string, string>()
    for (const e of employees ?? []) {
      empMap.set(e.id, e.full_name)
    }

    const now = new Date()
    const istHour = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
    ).getHours()
    const isWorkHours = istHour >= 9 && istHour < 20

    const result = (devices ?? []).map((d) => {
      let stale = false
      if (d.last_heartbeat_at) {
        const diffMs = now.getTime() - new Date(d.last_heartbeat_at).getTime()
        if (diffMs > 2 * 60 * 60 * 1000 && isWorkHours) {
          stale = true
        }
      } else if (isWorkHours) {
        stale = true // never sent a heartbeat
      }

      return {
        ...d,
        employee_name: empMap.get(d.employee_id) ?? "Unknown",
        stale,
      }
    })

    return NextResponse.json({ devices: result })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
