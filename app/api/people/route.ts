import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/people — active, login-capable colleagues in the caller's
 * workspace (id, name, avatar). Served via the admin client so collaboration
 * features (mentions, task members) can resolve names for everyone, not just
 * admins — the strict fs_employees RLS otherwise limits a non-admin to their
 * own row. Only non-sensitive display fields are returned.
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from("fs_employees")
    .select("id, full_name, avatar_url, role, reports_to, is_admin, department:departments!fs_employees_department_id_fkey(key)")
    .eq("org_id", caller.orgId)
    .eq("is_active", true)
    .not("auth_id", "is", null)
    .order("full_name")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Flatten the department embed to a plain key.
  const people = (data ?? []).map((p) => {
    const dept = p.department as { key: string } | { key: string }[] | null
    const department = Array.isArray(dept) ? dept[0]?.key ?? null : dept?.key ?? null
    return { ...p, department }
  })
  return NextResponse.json({ people })
}
