import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/employees/hierarchy
 * Get org tree — all employees with reports_to and role.
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { data: employees, error } = await admin
    .from("fs_employees")
    .select("id, full_name, designation, department, avatar_url, is_admin, is_active, reports_to, role")
    .eq("org_id", caller.orgId)
    .eq("is_active", true)
    .order("full_name")

  if (error) {
    return NextResponse.json({ error: "Failed to fetch hierarchy" }, { status: 500 })
  }

  return NextResponse.json({ employees: employees || [] })
}

/**
 * PATCH /api/employees/hierarchy
 * Update reports_to and/or role for an employee.
 */
export async function PATCH(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { employee_id, reports_to, role } = body

  if (!employee_id) {
    return NextResponse.json({ error: "employee_id is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify employee belongs to same org
  const { data: emp } = await admin
    .from("fs_employees")
    .select("id, org_id")
    .eq("id", employee_id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!emp) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (reports_to !== undefined) {
    updates.reports_to = reports_to || null
  }
  if (role !== undefined) {
    const validRoles = ["admin", "sales_admin", "manager", "setter", "viewer"]
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }
    updates.role = role
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  const { data: updated, error } = await admin
    .from("fs_employees")
    .update(updates)
    .eq("id", employee_id)
    .select("id, full_name, reports_to, role, is_admin")
    .single()

  if (error) {
    // Cycle detection trigger will raise an exception
    if (error.message.includes("Circular") || error.message.includes("cannot report to themselves")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ employee: updated })
}
