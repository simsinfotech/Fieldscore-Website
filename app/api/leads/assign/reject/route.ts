import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * POST /api/leads/assign/reject  (manager, or admin)
 * body: { leadIds?: string[], managerId?: string }
 * Returns the manager's pending leads to the unassigned pool.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const leadIds: string[] | undefined = body.leadIds

  let managerId: string | null = null
  if (caller.role === "manager") managerId = caller.employeeId
  else if (caller.isAdmin) managerId = body.managerId || null
  else return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!managerId) {
    return NextResponse.json({ error: "managerId is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  let q = admin
    .from("leads")
    .update({ assignment_state: "unassigned", pending_manager_id: null })
    .eq("org_id", caller.orgId)
    .eq("assignment_state", "pending_approval")
    .eq("pending_manager_id", managerId)
  if (leadIds && leadIds.length) q = q.in("id", leadIds)

  const { data, error } = await q.select("id")
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ returned: data?.length ?? 0 })
}
