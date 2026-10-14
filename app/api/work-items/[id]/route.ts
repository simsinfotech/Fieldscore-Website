import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

const SELECT =
  "*, assignee:fs_employees!work_items_assigned_to_fkey(id, full_name, avatar_url), " +
  "creator:fs_employees!work_items_created_by_fkey(id, full_name), " +
  "department:departments(id, name, key)"

// Field permission tiers:
//  - MEMBER_FIELDS: any task member (creator/assignee/watcher/admin) may edit
//    the shared canvas.
//  - STATUS: the assignee (or an editor) may move the task along.
//  - everything else (metadata): only the creator/admin/scope-manager.
const MEMBER_FIELDS = new Set(["body", "description"])
const EDITOR_FIELDS = [
  "type", "title", "priority",
  "assigned_to", "department_id", "watchers", "due_at",
  "estimate_hours", "linked_lead_id", "labels", "custom_fields",
  "requires_approval", "recurrence",
]
const ALL_WRITABLE = ["body", "description", "status", ...EDITOR_FIELDS]

/** Collect mentioned employee ids from a ProseMirror/TipTap document. */
function extractMentionIds(node: unknown, acc: Set<string>) {
  if (!node || typeof node !== "object") return
  const n = node as { type?: string; attrs?: { id?: string }; content?: unknown[] }
  if (n.type === "mention" && n.attrs?.id) acc.add(n.attrs.id)
  if (Array.isArray(n.content)) for (const c of n.content) extractMentionIds(c, acc)
}

async function canView(
  caller: Awaited<ReturnType<typeof resolveEmployee>>,
  w: { created_by: string; assigned_to: string | null; watchers?: string[] },
  admin: ReturnType<typeof getSupabaseAdmin>
) {
  if (!caller) return false
  if (
    caller.isAdmin ||
    w.created_by === caller.employeeId ||
    w.assigned_to === caller.employeeId ||
    w.watchers?.includes(caller.employeeId)
  ) return true
  if (w.assigned_to) {
    const { data: vis } = await admin.rpc("visible_user_ids", { p_user: caller.employeeId })
    return (vis ?? []).some((v: { user_id: string }) => v.user_id === w.assigned_to)
  }
  return false
}

/** GET /api/work-items/[id] — single item (for the detail page). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: item, error } = await admin
    .from("work_items")
    .select(SELECT)
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const row = item as unknown as {
    created_by: string; assigned_to: string | null; watchers?: string[]
  }
  if (!(await canView(caller, row, admin))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({ item })
}

/**
 * PATCH /api/work-items/[id] — update fields; stamps started_at /
 * completed_at on status transitions. Creator, an admin, or a manager whose
 * scope covers the assignee may edit any field. The assignee may only change
 * the status (work the item), not redefine it.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("work_items")
    .select("id, org_id, reference, created_by, assigned_to, watchers, status, type, title, body, recurrence, due_at, priority, department_id, estimate_hours, linked_lead_id, labels, custom_fields, requires_approval, description")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Editor = redefine the item (all fields); member = edit the shared canvas.
  let isEditor = caller.isAdmin || existing.created_by === caller.employeeId
  if (!isEditor && existing.assigned_to) {
    const { data: vis } = await admin.rpc("visible_user_ids", { p_user: caller.employeeId })
    isEditor = (vis ?? []).some((v: { user_id: string }) => v.user_id === existing.assigned_to)
  }
  const isAssignee = existing.assigned_to === caller.employeeId
  const isMember =
    isEditor || isAssignee || (existing.watchers ?? []).includes(caller.employeeId)

  if (!isMember) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Per-field authorisation.
  for (const f of Object.keys(body)) {
    if (!ALL_WRITABLE.includes(f)) continue
    const ok = MEMBER_FIELDS.has(f)
      ? isMember
      : f === "status"
        ? isAssignee || isEditor
        : isEditor
    if (!ok) {
      return NextResponse.json(
        { error: `You don't have permission to change "${f}"` },
        { status: 403 }
      )
    }
  }

  // Only admins/managers may (re)assign work to someone else.
  const canAssignOthers = caller.isAdmin || caller.role === "manager"
  if (
    body.assigned_to !== undefined &&
    body.assigned_to !== existing.assigned_to &&
    body.assigned_to !== caller.employeeId &&
    !canAssignOthers
  ) {
    return NextResponse.json(
      { error: "Only admins and managers can assign work to others" },
      { status: 403 }
    )
  }

  const updates: Record<string, unknown> = {}
  for (const f of ALL_WRITABLE) if (body[f] !== undefined) updates[f] = body[f]

  // Timestamp transitions
  if (updates.status && updates.status !== existing.status) {
    if (updates.status === "in_progress") updates.started_at = new Date().toISOString()
    if (updates.status === "done") updates.completed_at = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields" }, { status: 400 })
  }

  const { data: item, error } = await admin
    .from("work_items")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Recurrence: clone when marked "done" ──
  if (
    updates.status === "done" &&
    updates.status !== existing.status &&
    existing.recurrence &&
    existing.recurrence !== "none"
  ) {
    const shiftDays = existing.recurrence === "daily" ? 1 : 7
    let newDueAt: string | null = null
    const baseDue = (updates.due_at as string | undefined) || existing.due_at
    if (baseDue) {
      const d = new Date(baseDue)
      d.setDate(d.getDate() + shiftDays)
      newDueAt = d.toISOString()
    }

    await admin.from("work_items").insert({
      org_id: existing.org_id,
      created_by: existing.created_by,
      type: existing.type,
      title: existing.title,
      description: existing.description || null,
      status: "todo",
      priority: existing.priority,
      assigned_to: existing.assigned_to,
      department_id: existing.department_id || null,
      watchers: existing.watchers || [],
      due_at: newDueAt,
      estimate_hours: existing.estimate_hours ?? null,
      linked_lead_id: existing.linked_lead_id || null,
      requires_approval: existing.requires_approval ?? false,
      labels: existing.labels || [],
      custom_fields: existing.custom_fields || {},
      recurrence: existing.recurrence,
      recurrence_source_id: existing.id,
    })
  }

  const notifications: Record<string, unknown>[] = []

  // If the item was (re)assigned to someone new, notify them.
  const newAssignee = updates.assigned_to as string | null | undefined
  if (
    newAssignee &&
    newAssignee !== existing.assigned_to &&
    newAssignee !== caller.employeeId
  ) {
    notifications.push({
      recipient_id: newAssignee,
      type: "work_assigned",
      title: "Work assigned to you",
      message: `You've been assigned a ${item.type}: "${item.title}"`,
      link: `/work/${id}`,
    })
  }

  // If the canvas body changed, notify anyone newly @mentioned in it.
  if (updates.body !== undefined) {
    const before = new Set<string>()
    const after = new Set<string>()
    extractMentionIds(existing.body, before)
    extractMentionIds(updates.body, after)
    const fresh = [...after].filter((mid) => !before.has(mid) && mid !== caller.employeeId)
    if (fresh.length) {
      const { data: me } = await admin
        .from("fs_employees").select("full_name").eq("id", caller.employeeId).maybeSingle()
      const who = me?.full_name || "Someone"
      for (const recipient_id of fresh) {
        notifications.push({
          recipient_id,
          type: "mention",
          title: `${who} mentioned you`,
          message: `In ${existing.reference}: "${item.title}"`,
          link: `/work/${id}`,
        })
      }
    }
  }

  // Notify anyone newly added to the task's scope (watchers).
  if (updates.watchers !== undefined) {
    const before = new Set<string>(existing.watchers ?? [])
    const added = (updates.watchers as string[]).filter((w) => !before.has(w) && w !== caller.employeeId)
    for (const recipient_id of added) {
      notifications.push({
        recipient_id,
        type: "work_added",
        title: "Added to a work item",
        message: `You were added to ${existing.reference}: "${item.title}"`,
        link: `/work/${id}`,
      })
    }
  }

  if (notifications.length) await admin.from("fs_notifications").insert(notifications)

  return NextResponse.json({ item })
}

/**
 * DELETE /api/work-items/[id] — creator or admin only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("work_items")
    .select("id, created_by")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!caller.isAdmin && existing.created_by !== caller.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await admin.from("work_items").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
