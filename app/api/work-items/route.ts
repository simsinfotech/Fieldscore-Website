import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

const SELECT =
  "*, assignee:fs_employees!work_items_assigned_to_fkey(id, full_name, avatar_url), " +
  "creator:fs_employees!work_items_created_by_fkey(id, full_name), " +
  "department:departments(id, name, key)"

/**
 * GET /api/work-items?status=&type=&mine=1
 * Returns work items visible to the caller (created by / assigned to /
 * watching / assigned within their scope; admins see the org).
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const url = request.nextUrl
  const status = url.searchParams.get("status")
  const type = url.searchParams.get("type")
  const mine = url.searchParams.get("mine") === "1"

  let query = admin
    .from("work_items")
    .select(SELECT)
    .eq("org_id", caller.orgId)
    .order("priority", { ascending: true })
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (status) query = query.eq("status", status)
  if (type) query = query.eq("type", type)
  if (mine) query = query.eq("assigned_to", caller.employeeId)

  const { data: items, error } = await query
  if (error) {
    console.error("work-items query error:", error)
    return NextResponse.json({ error: "Failed to fetch work items" }, { status: 500 })
  }

  // Scope filter (admins see all in org)
  type WorkRow = Record<string, unknown> & {
    created_by: string
    assigned_to: string | null
    watchers: string[]
  }
  let visible = (items ?? []) as unknown as WorkRow[]
  if (!caller.isAdmin && !mine) {
    const { data: vis } = await admin.rpc("visible_user_ids", { p_user: caller.employeeId })
    const visibleIds = new Set((vis ?? []).map((v: { user_id: string }) => v.user_id))
    visible = visible.filter(
      (w) =>
        w.created_by === caller.employeeId ||
        w.assigned_to === caller.employeeId ||
        w.watchers?.includes(caller.employeeId) ||
        (w.assigned_to && visibleIds.has(w.assigned_to))
    )
  }

  return NextResponse.json({ items: visible })
}

/**
 * POST /api/work-items — create a work item (created_by = caller).
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 })
  }

  // Only admins and managers may assign work to someone else; everyone else
  // can create items for themselves or leave them unassigned.
  const canAssignOthers = caller.isAdmin || caller.role === "manager"
  if (
    body.assigned_to &&
    body.assigned_to !== caller.employeeId &&
    !canAssignOthers
  ) {
    return NextResponse.json(
      { error: "Only admins and managers can assign work to others" },
      { status: 403 }
    )
  }

  const admin = getSupabaseAdmin()
  const { data: item, error } = await admin
    .from("work_items")
    .insert({
      org_id: caller.orgId,
      created_by: caller.employeeId,
      type: body.type || "task",
      title: body.title.trim(),
      description: body.description || null,
      status: body.status || "todo",
      priority: body.priority ?? 3,
      assigned_to: body.assigned_to || null,
      department_id: body.department_id || null,
      watchers: body.watchers || [],
      due_at: body.due_at || null,
      estimate_hours: body.estimate_hours ?? null,
      linked_lead_id: body.linked_lead_id || null,
      requires_approval: body.requires_approval ?? false,
      labels: body.labels || [],
      custom_fields: body.custom_fields || {},
      recurrence: body.recurrence || "none",
    })
    .select(SELECT)
    .single()

  if (error) {
    console.error("work-item create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify the assignee (unless they assigned it to themselves).
  const created = item as unknown as {
    assigned_to: string | null
    type: string
    title: string
  }
  if (created.assigned_to && created.assigned_to !== caller.employeeId) {
    await admin.from("fs_notifications").insert({
      recipient_id: created.assigned_to,
      type: "work_assigned",
      title: "New work assigned",
      message: `You've been assigned a ${created.type}: "${created.title}"`,
      link: "/work",
    })
  }

  return NextResponse.json({ item }, { status: 201 })
}
