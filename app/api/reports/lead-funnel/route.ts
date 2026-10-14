import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

const FUNNEL_STAGES = [
  "new", "contacted", "qualified",
  "site_visit_planned", "site_visit_done", "site_visit",
  "negotiation", "booking", "won", "lost", "nurtured", "junk",
]

/**
 * GET /api/reports/lead-funnel?source=&from=&to=
 * COUNT leads GROUP BY status — funnel visualization data.
 * Admin/manager/sales_admin only.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "manager" && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = request.nextUrl
  const source = url.searchParams.get("source")
  const from = url.searchParams.get("from")
  const to = url.searchParams.get("to")

  const admin = getSupabaseAdmin()

  let query = admin
    .from("leads")
    .select("status", { count: "exact" })
    .eq("org_id", caller.orgId)

  if (source) query = query.eq("source", source)
  if (from) query = query.gte("created_at", `${from}T00:00:00`)
  if (to) query = query.lte("created_at", `${to}T23:59:59`)

  // For managers, scope to their subtree
  if (caller.role === "manager" && !caller.isAdmin) {
    const { data: subtree } = await admin.rpc("subtree_ids", { p_root: caller.employeeId })
    const ids = (subtree || []).map((s: { id: string }) => s.id)
    if (ids.length > 0) {
      query = query.in("assigned_to", ids)
    }
  }

  const { data: leads, error } = await query

  if (error) {
    console.error("lead funnel query error:", error)
    return NextResponse.json({ error: "Failed to fetch funnel data" }, { status: 500 })
  }

  // Count by status
  const counts: Record<string, number> = {}
  for (const stage of FUNNEL_STAGES) counts[stage] = 0

  for (const lead of leads || []) {
    const status = lead.status as string
    counts[status] = (counts[status] || 0) + 1
  }

  const funnel = FUNNEL_STAGES.map((stage) => ({
    stage,
    count: counts[stage] || 0,
  }))

  const total = funnel.reduce((s, f) => s + f.count, 0)

  return NextResponse.json({ funnel, total })
}
