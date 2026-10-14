import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { SupabaseClient } from "@supabase/supabase-js"

type Caller = { employeeId: string; isAdmin: boolean; role: string; orgId: string }

/** Whether the caller may view/act on this lead. */
async function canAccess(admin: SupabaseClient, caller: Caller, leadId: string) {
  const { data: lead } = await admin
    .from("leads")
    .select("id, assigned_to, pending_manager_id")
    .eq("id", leadId)
    .eq("org_id", caller.orgId)
    .maybeSingle()
  if (!lead) return false
  if (caller.isAdmin || caller.role === "viewer") return true
  if (caller.role === "setter") return lead.assigned_to === caller.employeeId
  if (caller.role === "manager") {
    if (lead.pending_manager_id === caller.employeeId) return true
    const { data: sub } = await admin.rpc("subtree_ids", { p_root: caller.employeeId })
    const ids = (sub ?? []).map((s: { id: string }) => s.id)
    return !!lead.assigned_to && ids.includes(lead.assigned_to)
  }
  return false
}

/** GET — activity timeline for a lead. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const admin = getSupabaseAdmin()

  if (!(await canAccess(admin, caller, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data } = await admin
    .from("lead_activities")
    .select("*, actor:fs_employees!lead_activities_actor_id_fkey(full_name)")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })

  return NextResponse.json({ activities: data ?? [] })
}

/** POST — log a note/call/whatsapp. body: { type, body } */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params
  const { type, body } = await request.json()

  const validTypes = ["note", "call", "whatsapp"]
  if (!validTypes.includes(type)) {
    return NextResponse.json({ error: "Invalid activity type" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  if (!(await canAccess(admin, caller, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data, error } = await admin
    .from("lead_activities")
    .insert({ lead_id: id, actor_id: caller.employeeId, type, body: body || null })
    .select("*, actor:fs_employees!lead_activities_actor_id_fkey(full_name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ activity: data }, { status: 201 })
}
