import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export async function POST() {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = getSupabaseAdmin()

    // Rate limit: 4 requests/minute/user. Backed by Postgres so it is
    // shared across serverless instances (not in-memory).
    const { data: allowed, error: rateError } = await admin.rpc(
      "bump_heartbeat_rate",
      { p_employee_id: caller.employeeId, p_limit: 4 }
    )
    if (!rateError && allowed === false) {
      return NextResponse.json(
        { error: "rate_limited" },
        { status: 429 }
      )
    }

    // Find open session
    let { data: session } = await admin
      .from("attendance_sessions")
      .select("id")
      .eq("employee_id", caller.employeeId)
      .is("ended_at", null)
      .maybeSingle()

    // Auto-resume: user is checked in but session was closed (e.g. tab close).
    // Create a new session so activity tracking continues seamlessly.
    if (!session) {
      const today = new Date().toISOString().split("T")[0]
      const { data: attendance } = await admin
        .from("fs_attendance")
        .select("check_in, check_out")
        .eq("employee_id", caller.employeeId)
        .eq("date", today)
        .maybeSingle()

      if (!attendance?.check_in || attendance.check_out) {
        return NextResponse.json({ recorded: false, reason: "no_open_session" })
      }

      const { data: resumed, error: sessError } = await admin
        .from("attendance_sessions")
        .insert({
          employee_id: caller.employeeId,
          org_id: caller.orgId,
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single()

      if (sessError || !resumed) {
        return NextResponse.json({ recorded: false, reason: "session_resume_failed" })
      }

      session = resumed
    }

    // Truncate current time to the minute boundary
    const now = new Date()
    now.setSeconds(0, 0)
    const bucket = now.toISOString()

    // Idempotent insert — ON CONFLICT DO NOTHING at the DB level
    const { error } = await admin
      .from("activity_minutes")
      .upsert(
        {
          employee_id: caller.employeeId,
          bucket,
          session_id: session.id,
        },
        { onConflict: "employee_id,bucket", ignoreDuplicates: true }
      )

    if (error) throw error

    return NextResponse.json({ recorded: true, bucket })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
