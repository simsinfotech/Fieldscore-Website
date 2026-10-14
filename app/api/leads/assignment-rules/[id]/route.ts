import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/leads/assignment-rules/[id]
 * Update an assignment rule.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  const allowedFields = [
    "label",
    "strategy",
    "pool_root_id",
    "is_active",
    "source_filter",
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key]
    }
  }

  if (updates.strategy) {
    const validStrategies = ["round_robin", "manual"]
    if (!validStrategies.includes(updates.strategy as string)) {
      return NextResponse.json({ error: "Invalid strategy" }, { status: 400 })
    }
  }

  const { data: rule, error } = await admin
    .from("assignment_rules")
    .update(updates)
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rule })
}

/**
 * DELETE /api/leads/assignment-rules/[id]
 * Delete an assignment rule.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const admin = getSupabaseAdmin()

  const { error } = await admin
    .from("assignment_rules")
    .delete()
    .eq("id", id)
    .eq("org_id", caller.orgId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
