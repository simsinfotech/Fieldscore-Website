import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit, diffFields } from "@/lib/audit/log"
import { fireTrigger } from "@/lib/workflows/engine"
import type { SupabaseClient } from "@supabase/supabase-js"

// Fields each role may write.
const ADMIN_FIELDS = [
  "status", "full_name", "email", "project", "budget_min",
  "budget_max", "city", "source", "notes", "assigned_to", "source_label",
  // RE-specific fields
  "configuration", "preferred_locations", "purpose", "financing",
  "possession_timeline", "decision_makers", "temperature", "score",
]
const WORKER_FIELDS = [
  "status", "notes",
  // Workers can update RE fields from call context
  "configuration", "preferred_locations", "purpose", "financing",
  "possession_timeline", "decision_makers", "temperature",
]

interface LeadRow {
  id: string
  assigned_to: string | null
  pending_manager_id: string | null
  status: string
}

/** Can this caller edit the lead, and which fields? */
async function resolvePermission(
  admin: SupabaseClient,
  caller: { employeeId: string; isAdmin: boolean; role: string },
  lead: LeadRow
): Promise<string[] | null> {
  if (caller.isAdmin) return ADMIN_FIELDS
  if (caller.role === "setter") {
    return lead.assigned_to === caller.employeeId ? WORKER_FIELDS : null
  }
  if (caller.role === "manager") {
    if (lead.pending_manager_id === caller.employeeId) return WORKER_FIELDS
    const { data: sub } = await admin.rpc("subtree_ids", { p_root: caller.employeeId })
    const ids = (sub ?? []).map((s: { id: string }) => s.id)
    return lead.assigned_to && ids.includes(lead.assigned_to) ? WORKER_FIELDS : null
  }
  return null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { id } = await params
  const body = await request.json()

  const { data: existing } = await admin
    .from("leads")
    .select("*")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const allowed = await resolvePermission(admin, caller, existing as LeadRow)
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const updates: Record<string, unknown> = {}
  for (const field of allowed) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: lead, error } = await admin
    .from("leads")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("Lead update error:", error)
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
  }

  // Log a status change to the activity timeline (reporting rollup).
  if (updates.status && updates.status !== existing.status) {
    await admin.from("lead_activities").insert({
      lead_id: id,
      actor_id: caller.employeeId,
      type: "status_change",
      body: `Status → ${updates.status}`,
    })
  }

  // Audit trail
  const allFields = [...ADMIN_FIELDS, ...WORKER_FIELDS]
  const diff = diffFields(existing, { ...existing, ...updates }, allFields)
  if (diff) {
    await logAudit({
      orgId: caller.orgId,
      actorId: caller.employeeId,
      entity: "lead",
      entityId: id,
      action: "update",
      before: diff.before,
      after: diff.after,
      source: "manual",
    })
  }

  // Fire workflow trigger on stage change
  if (updates.status && updates.status !== existing.status) {
    fireTrigger({
      orgId: caller.orgId,
      trigger: "stage_changed",
      entityType: "lead",
      entityId: id,
      data: {
        old_status: existing.status,
        new_status: updates.status,
        temperature: existing.temperature,
        assigned_to: existing.assigned_to,
      },
      actorId: caller.employeeId,
    }).catch((err) => console.error("workflow: stage_changed trigger failed", err))
  }

  return NextResponse.json({ lead })
}
