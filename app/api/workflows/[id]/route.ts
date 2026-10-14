import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"

/**
 * GET /api/workflows/[id]
 * Single workflow rule with execution history.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: rule } = await admin
    .from("workflow_rules")
    .select("*, creator:fs_employees!workflow_rules_created_by_fkey(id, full_name)")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!rule) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })

  // Recent executions
  const { data: executions } = await admin
    .from("workflow_executions")
    .select("*")
    .eq("rule_id", id)
    .order("executed_at", { ascending: false })
    .limit(20)

  return NextResponse.json({ workflow: rule, executions: executions || [] })
}

/**
 * PATCH /api/workflows/[id]
 * Update a workflow rule. Admin/sales_admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("workflow_rules")
    .select("*")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description
  if (body.trigger !== undefined) updates.trigger = body.trigger
  if (body.conditions !== undefined) updates.conditions = body.conditions
  if (body.actions !== undefined) updates.actions = body.actions
  if (body.is_active !== undefined) updates.is_active = body.is_active
  if (body.priority !== undefined) updates.priority = body.priority

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: rule, error } = await admin
    .from("workflow_rules")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) {
    console.error("workflow update error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "workflow_rule",
    entityId: id,
    action: "update",
    before: { is_active: existing.is_active, name: existing.name },
    after: updates,
    source: "manual",
  })

  return NextResponse.json({ workflow: rule })
}

/**
 * DELETE /api/workflows/[id]
 * Admin only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("workflow_rules")
    .select("id, name")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Workflow not found" }, { status: 404 })

  const { error } = await admin.from("workflow_rules").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "workflow_rule",
    entityId: id,
    action: "delete",
    before: { name: existing.name },
    source: "manual",
  })

  return NextResponse.json({ success: true })
}
