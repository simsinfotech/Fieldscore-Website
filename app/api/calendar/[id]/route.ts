import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit, diffFields } from "@/lib/audit/log"
import { fireTrigger } from "@/lib/workflows/engine"

const SELECT =
  "*, employee:fs_employees!calendar_events_employee_id_fkey(id, full_name, avatar_url), " +
  "lead:leads!calendar_events_lead_id_fkey(id, full_name, phone_e164)"

/**
 * GET /api/calendar/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: event } = await admin
    .from("calendar_events")
    .select(SELECT)
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  return NextResponse.json({ event })
}

/**
 * PATCH /api/calendar/[id]
 * Update event fields. Owner or admin only.
 * When status changes to completed/cancelled, fires workflow trigger.
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
    .from("calendar_events")
    .select("*")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 })

  // Only the event owner or admin can update
  if (existing.employee_id !== caller.employeeId && !caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const allowedFields = [
    "title", "description", "event_type", "start_at", "end_at",
    "location", "is_all_day", "status", "outcome",
  ]

  const updates: Record<string, unknown> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: event, error } = await admin
    .from("calendar_events")
    .update(updates)
    .eq("id", id)
    .select(SELECT)
    .single()

  if (error) {
    console.error("calendar update error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Audit
  const diff = diffFields(existing, { ...existing, ...updates }, allowedFields)
  if (diff) {
    await logAudit({
      orgId: caller.orgId,
      actorId: caller.employeeId,
      entity: "calendar_event",
      entityId: id,
      action: "update",
      before: diff.before,
      after: diff.after,
      source: "manual",
    })
  }

  // Fire workflow triggers on status change
  if (updates.status && updates.status !== existing.status) {
    const leadId = existing.lead_id

    if (updates.status === "completed" && existing.event_type === "site_visit" && leadId) {
      fireTrigger({
        orgId: caller.orgId,
        trigger: "visit_completed",
        entityType: "lead",
        entityId: leadId,
        data: {
          event_id: id,
          event_type: existing.event_type,
          outcome: body.outcome || null,
          lead_id: leadId,
        },
        actorId: caller.employeeId,
      }).catch((err) => console.error("workflow: visit_completed trigger failed", err))

      // Log on lead timeline
      await admin.from("lead_activities").insert({
        lead_id: leadId,
        actor_id: caller.employeeId,
        type: "visit",
        body: `Site visit completed${body.outcome ? `: ${body.outcome}` : ""}`,
      })
    }

    if (updates.status === "cancelled" && existing.event_type === "site_visit" && leadId) {
      fireTrigger({
        orgId: caller.orgId,
        trigger: "visit_cancelled",
        entityType: "lead",
        entityId: leadId,
        data: {
          event_id: id,
          event_type: existing.event_type,
          lead_id: leadId,
        },
        actorId: caller.employeeId,
      }).catch((err) => console.error("workflow: visit_cancelled trigger failed", err))
    }
  }

  return NextResponse.json({ event })
}

/**
 * DELETE /api/calendar/[id]
 * Owner or admin only.
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
    .from("calendar_events")
    .select("id, employee_id, title")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Event not found" }, { status: 404 })
  if (existing.employee_id !== caller.employeeId && !caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await admin.from("calendar_events").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
