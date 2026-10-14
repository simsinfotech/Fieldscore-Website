import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/workflows — list workflow rules.
 * Admin/sales_admin only.
 */
export async function GET(_request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()

  const { data: rules, error } = await admin
    .from("workflow_rules")
    .select("*, creator:fs_employees!workflow_rules_created_by_fkey(id, full_name)")
    .eq("org_id", caller.orgId)
    .order("priority", { ascending: true })

  if (error) {
    console.error("workflow rules query error:", error)
    return NextResponse.json({ error: "Failed to fetch workflows" }, { status: 500 })
  }

  return NextResponse.json({ workflows: rules || [] })
}

/**
 * POST /api/workflows — create a workflow rule.
 * Admin/sales_admin only.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()

  if (!body.name?.trim() || !body.trigger) {
    return NextResponse.json({ error: "name and trigger are required" }, { status: 400 })
  }

  if (!body.actions || !Array.isArray(body.actions) || body.actions.length === 0) {
    return NextResponse.json({ error: "At least one action is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: rule, error } = await admin
    .from("workflow_rules")
    .insert({
      org_id: caller.orgId,
      name: body.name.trim(),
      description: body.description || null,
      trigger: body.trigger,
      conditions: body.conditions || {},
      actions: body.actions,
      is_active: body.is_active ?? true,
      priority: body.priority ?? 100,
      created_by: caller.employeeId,
    })
    .select("*")
    .single()

  if (error) {
    console.error("workflow rule create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ workflow: rule }, { status: 201 })
}
