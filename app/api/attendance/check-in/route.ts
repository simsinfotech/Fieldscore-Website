import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { OFFICE_TIMINGS } from "@/lib/config"
import { SESSION_TIMEOUT_MINUTES } from "@/lib/attendance/constants"

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { lat, lng, address } = await request.json()
    const admin = getSupabaseAdmin()
    const now = new Date()

    // Check for existing open session
    const { data: existing } = await admin
      .from("attendance_sessions")
      .select("id, started_at")
      .eq("employee_id", caller.employeeId)
      .is("ended_at", null)
      .maybeSingle()

    if (existing) {
      // Self-heal: if the open session has gone stale (a forgotten
      // checkout), close it at its last-seen time and let this check-in
      // open a fresh session — don't lock the user out until the cron runs.
      const { data: lastBeat } = await admin
        .from("activity_minutes")
        .select("bucket")
        .eq("session_id", existing.id)
        .order("bucket", { ascending: false })
        .limit(1)
        .maybeSingle()

      const lastSeen = new Date(lastBeat?.bucket ?? existing.started_at)
      const isStale =
        now.getTime() - lastSeen.getTime() > SESSION_TIMEOUT_MINUTES * 60_000

      if (!isStale) {
        return NextResponse.json(
          { error: "Already have an open session" },
          { status: 409 }
        )
      }

      // Close the stale session at last-seen (never before its start).
      const startedAt = new Date(existing.started_at)
      const endedAt =
        lastSeen > startedAt
          ? lastSeen
          : new Date(startedAt.getTime() + 60_000)

      await admin
        .from("attendance_sessions")
        .update({ ended_at: endedAt.toISOString(), end_reason: "idle_timeout" })
        .eq("id", existing.id)
        .is("ended_at", null)

      await admin.rpc("recompute_daily", {
        p_employee_id: caller.employeeId,
        p_date: existing.started_at.split("T")[0],
      })
    }

    // Create new session
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || ""
    const ua = request.headers.get("user-agent") || ""

    const { data: session, error: sessError } = await admin
      .from("attendance_sessions")
      .insert({
        employee_id: caller.employeeId,
        org_id: caller.orgId,
        started_at: now.toISOString(),
        start_lat: lat,
        start_lng: lng,
        start_address: address,
        ip_address: ip,
        user_agent: ua,
      })
      .select()
      .single()

    if (sessError) throw sessError

    // Determine status for fs_attendance compat
    const hour = now.getHours()
    const minute = now.getMinutes()
    const isLate =
      hour > OFFICE_TIMINGS.startHour ||
      (hour === OFFICE_TIMINGS.startHour && minute > OFFICE_TIMINGS.startMinute)
    const status = isLate ? "late" : "present"

    const today = now.toISOString().split("T")[0]

    // Upsert fs_attendance for backward compatibility
    await admin
      .from("fs_attendance")
      .upsert(
        {
          employee_id: caller.employeeId,
          date: today,
          check_in: now.toISOString(),
          check_in_lat: lat,
          check_in_lng: lng,
          check_in_address: address,
          status,
        },
        { onConflict: "employee_id,date" }
      )

    return NextResponse.json({ session }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
