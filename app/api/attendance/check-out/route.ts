import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { OFFICE_TIMINGS } from "@/lib/config"

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { lat, lng, address } = await request.json()
    const admin = getSupabaseAdmin()
    const now = new Date()

    // Find open session
    const { data: session } = await admin
      .from("attendance_sessions")
      .select("*")
      .eq("employee_id", caller.employeeId)
      .is("ended_at", null)
      .maybeSingle()

    if (!session) {
      return NextResponse.json(
        { error: "No open session found" },
        { status: 404 }
      )
    }

    // Close session
    const { data: closed, error: closeError } = await admin
      .from("attendance_sessions")
      .update({
        ended_at: now.toISOString(),
        end_reason: "manual",
        end_lat: lat,
        end_lng: lng,
        end_address: address,
      })
      .eq("id", session.id)
      .select()
      .single()

    if (closeError) throw closeError

    // Update fs_attendance for backward compatibility
    const today = now.toISOString().split("T")[0]
    const checkInTime = new Date(session.started_at)
    const hoursWorked = (now.getTime() - checkInTime.getTime()) / (1000 * 60 * 60)

    // Get the existing fs_attendance to preserve status
    const { data: existing } = await admin
      .from("fs_attendance")
      .select("status")
      .eq("employee_id", caller.employeeId)
      .eq("date", today)
      .maybeSingle()

    let status = existing?.status || "present"
    if (hoursWorked < OFFICE_TIMINGS.halfDayThreshold) status = "half_day"

    await admin
      .from("fs_attendance")
      .upsert(
        {
          employee_id: caller.employeeId,
          date: today,
          check_out: now.toISOString(),
          check_out_lat: lat,
          check_out_lng: lng,
          check_out_address: address,
          work_hours: Math.round(hoursWorked * 100) / 100,
          status,
        },
        { onConflict: "employee_id,date" }
      )

    // Trigger rollup for this employee/day
    await admin.rpc("recompute_daily", {
      p_employee_id: caller.employeeId,
      p_date: today,
    })

    return NextResponse.json({ session: closed })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
