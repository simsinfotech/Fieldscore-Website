import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

type Caller = NonNullable<Awaited<ReturnType<typeof resolveEmployee>>>

/** Load the work item and confirm the caller may see it. */
async function loadVisibleItem(
  caller: Caller,
  id: string,
  admin: ReturnType<typeof getSupabaseAdmin>
) {
  const { data: item } = await admin
    .from("work_items")
    .select("id, org_id, created_by, assigned_to, watchers")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()
  if (!item) return { item: null, canView: false }

  let canView =
    caller.isAdmin ||
    item.created_by === caller.employeeId ||
    item.assigned_to === caller.employeeId ||
    (item.watchers ?? []).includes(caller.employeeId)
  if (!canView && item.assigned_to) {
    const { data: vis } = await admin.rpc("visible_user_ids", { p_user: caller.employeeId })
    canView = (vis ?? []).some((v: { user_id: string }) => v.user_id === item.assigned_to)
  }
  return { item, canView }
}

/**
 * GET /api/work-items/[id]/timer
 * Returns all time entries for this item, the caller's running entry (if any),
 * and total tracked minutes.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()
  const { item, canView } = await loadVisibleItem(caller, id, admin)
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: entries, error } = await admin
    .from("work_time_entries")
    .select("*")
    .eq("work_item_id", id)
    .order("started_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const running = (entries ?? []).find(
    (e: { employee_id: string; ended_at: string | null }) =>
      e.employee_id === caller.employeeId && !e.ended_at
  ) || null

  const totalMinutes = (entries ?? []).reduce(
    (sum: number, e: { duration_minutes: number | null }) =>
      sum + (e.duration_minutes ?? 0),
    0
  )

  return NextResponse.json({ entries: entries ?? [], running, totalMinutes })
}

/**
 * POST /api/work-items/[id]/timer — start a timer.
 * Returns 409 if the caller already has a running timer on any work item.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()
  const { item, canView } = await loadVisibleItem(caller, id, admin)
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: entry, error } = await admin
    .from("work_time_entries")
    .insert({
      work_item_id: id,
      employee_id: caller.employeeId,
      org_id: caller.orgId,
    })
    .select("*")
    .single()

  if (error) {
    // Unique partial index violation = already has a running timer
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "You already have a running timer. Stop it first." },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ entry }, { status: 201 })
}

/**
 * PATCH /api/work-items/[id]/timer — stop the caller's running timer.
 * Computes duration_minutes from elapsed time.
 */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  // Find the caller's running entry on this item
  const { data: running } = await admin
    .from("work_time_entries")
    .select("id, started_at")
    .eq("work_item_id", id)
    .eq("employee_id", caller.employeeId)
    .is("ended_at", null)
    .maybeSingle()

  if (!running) {
    return NextResponse.json({ error: "No running timer found" }, { status: 404 })
  }

  const now = new Date()
  const started = new Date(running.started_at)
  const durationMinutes = Math.round(((now.getTime() - started.getTime()) / 60000) * 100) / 100

  const { data: entry, error } = await admin
    .from("work_time_entries")
    .update({
      ended_at: now.toISOString(),
      duration_minutes: durationMinutes,
    })
    .eq("id", running.id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entry })
}
