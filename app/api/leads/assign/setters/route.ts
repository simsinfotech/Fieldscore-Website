import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/leads/assign/setters[?managerId=]
 * The active setters under a manager's subtree — used to render per-setter
 * instruction fields in the approve dialog. Manager gets their own;
 * admin may pass ?managerId.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let managerId: string | null = null
  if (caller.role === "manager") managerId = caller.employeeId
  else if (caller.isAdmin) managerId = request.nextUrl.searchParams.get("managerId")
  else return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!managerId) return NextResponse.json({ setters: [] })

  const admin = getSupabaseAdmin()
  const { data: sub } = await admin.rpc("subtree_ids", { p_root: managerId })
  const ids = (sub ?? []).map((s: { id: string }) => s.id).filter((id: string) => id !== managerId)
  if (ids.length === 0) return NextResponse.json({ setters: [] })

  const { data: setters } = await admin
    .from("fs_employees")
    .select("id, full_name")
    .in("id", ids)
    .eq("role", "setter")
    .eq("is_active", true)
    .order("full_name")

  return NextResponse.json({ setters: setters ?? [] })
}
