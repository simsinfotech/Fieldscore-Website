import { createClient } from "@/lib/supabase/server"

import type { EmployeeRole } from "@/types"

export interface ResolvedEmployee {
  employeeId: string
  orgId: string
  isAdmin: boolean
  role: EmployeeRole
  /** Department key (e.g. 'marketing'), or null if unassigned. */
  department: string | null
}

/**
 * Authenticate the current request via the server Supabase client
 * and resolve the caller's employee_id, org_id, and admin status.
 * Returns null if unauthenticated or no employee record found.
 */
export async function resolveEmployee(): Promise<ResolvedEmployee | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: employee } = await supabase
    .from("fs_employees")
    // Disambiguate the embed: fs_employees relates to departments via BOTH
    // department_id and departments.head_id, so the FK must be named.
    .select("id, org_id, is_admin, role, department:departments!fs_employees_department_id_fkey(key)")
    .eq("auth_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (!employee) return null

  const dept = employee.department as { key: string } | { key: string }[] | null
  const departmentKey = Array.isArray(dept) ? dept[0]?.key ?? null : dept?.key ?? null

  return {
    employeeId: employee.id,
    orgId: employee.org_id,
    isAdmin: employee.is_admin,
    role: employee.role ?? (employee.is_admin ? "admin" : "viewer"),
    department: departmentKey,
  }
}
