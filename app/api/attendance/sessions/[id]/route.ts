import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * PATCH /api/attendance/sessions/[id]
 * Admin/HR only. Override a session's start/end times with a mandatory
 * reason. The original values are retained in attendance_session_overrides
 * and the day is recomputed. (T-10)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { started_at, ended_at, reason } = body as {
    started_at?: string
    ended_at?: string
    reason?: string
  }

  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "A reason is required" }, { status: 400 })
  }
  if (started_at === undefined && ended_at === undefined) {
    return NextResponse.json(
      { error: "Provide started_at and/or ended_at" },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Load session and verify it belongs to the caller's org
  const { data: session } = await admin
    .from("attendance_sessions")
    .select("*")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  const newStart = started_at ?? session.started_at
  const newEnd = ended_at ?? session.ended_at

  if (newEnd && new Date(newEnd) <= new Date(newStart)) {
    return NextResponse.json(
      { error: "ended_at must be after started_at" },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}
  if (started_at !== undefined) updates.started_at = started_at
  if (ended_at !== undefined) {
    updates.ended_at = ended_at
    updates.end_reason = "admin_override"
  }

  const { data: updated, error } = await admin
    .from("attendance_sessions")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit trail — retain original values
  await admin.from("attendance_session_overrides").insert({
    session_id: id,
    employee_id: session.employee_id,
    actor_id: caller.employeeId,
    before_state: {
      started_at: session.started_at,
      ended_at: session.ended_at,
      end_reason: session.end_reason,
    },
    after_state: {
      started_at: updated.started_at,
      ended_at: updated.ended_at,
      end_reason: updated.end_reason,
    },
    reason: reason.trim(),
  })

  // Recompute the affected day(s)
  const dates = new Set<string>([
    String(session.started_at).split("T")[0],
    String(updated.started_at).split("T")[0],
  ])
  for (const d of dates) {
    await admin.rpc("recompute_daily", {
      p_employee_id: session.employee_id,
      p_date: d,
    })
  }

  return NextResponse.json({ session: updated })
}
