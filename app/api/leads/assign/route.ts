import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { fireTrigger } from "@/lib/workflows/engine"

/**
 * POST /api/leads/assign  (admin)
 * body: { leadIds: string[], managerId: string }
 * Directly assigns selected leads to an employee. Leads already
 * assigned to someone else are skipped (dedup guard).
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { leadIds, managerId, all, filters } = await request.json()
  if (!managerId) {
    return NextResponse.json({ error: "managerId is required" }, { status: 400 })
  }
  if (!all && (!Array.isArray(leadIds) || leadIds.length === 0)) {
    return NextResponse.json({ error: "leadIds or all=true is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Manager must be an active member of this workspace.
  const { data: mgr } = await admin
    .from("fs_employees")
    .select("id, role")
    .eq("id", managerId)
    .eq("org_id", caller.orgId)
    .eq("is_active", true)
    .maybeSingle()
  if (!mgr) return NextResponse.json({ error: "Manager not found" }, { status: 404 })

  // Directly assign leads (only unassigned ones — dedup guard).
  let q = admin
    .from("leads")
    .update({ assigned_to: managerId, assignment_state: "assigned" })
    .eq("org_id", caller.orgId)
    .eq("assignment_state", "unassigned")

  if (all) {
    // Assign every unassigned lead matching the admin's current filters.
    const f = filters || {}
    if (f.source) q = q.eq("source", f.source)
    if (f.status) q = q.eq("status", f.status)
    if (f.label) q = q.eq("source_label", f.label)
    if (f.search) {
      const isPhone = /^[\d+]/.test(f.search)
      q = isPhone ? q.ilike("phone_e164", `%${f.search}%`) : q.ilike("full_name", `%${f.search}%`)
    }
  } else {
    q = q.in("id", leadIds)
  }

  const { data, error } = await q.select("id")

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the employee
  await admin.from("fs_notifications").insert({
    recipient_id: managerId,
    type: "leads_assigned",
    title: "New leads assigned to you",
    message: `${data?.length ?? 0} lead(s) have been assigned to you`,
    link: "/leads",
  })

  // Fire workflow triggers for assigned leads
  for (const lead of data || []) {
    fireTrigger({
      orgId: caller.orgId,
      trigger: "lead_assigned",
      entityType: "lead",
      entityId: lead.id,
      data: { assigned_to: managerId },
      actorId: caller.employeeId,
    }).catch((err) => console.error("workflow: lead_assigned trigger failed", err))
  }

  return NextResponse.json({ assigned: data?.length ?? 0 })
}
