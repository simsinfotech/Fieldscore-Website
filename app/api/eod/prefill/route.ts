import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/eod/prefill — everything the EOD form pre-fills:
 *  - the caller's department (selects the KPI template)
 *  - for sales, today's activity auto-summarised from lead data
 *  - the caller's assigned tasks (open + finished today) with their status
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  // Day boundary in IST (the team's timezone) so "today's activity" is the
  // real business day — not the UTC day, which would misplace anything logged
  // between 00:00–05:30 IST.
  const IST_OFFSET = 330 * 60000
  const istMidnight = new Date(Date.now() + IST_OFFSET)
  istMidnight.setUTCHours(0, 0, 0, 0)
  const startISO = new Date(istMidnight.getTime() - IST_OFFSET).toISOString()

  // --- Assigned tasks: open, plus any completed today ---
  const { data: allTasks } = await admin
    .from("work_items")
    .select("id, reference, title, type, status, completed_at, updated_at")
    .eq("org_id", caller.orgId)
    .eq("assigned_to", caller.employeeId)
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false })

  const workItems = (allTasks ?? [])
    .filter((t) => t.status !== "done" || (t.completed_at && t.completed_at >= startISO))
    .map((t) => ({ work_item_id: t.id, reference: t.reference, title: t.title, type: t.type, status: t.status }))

  const allAssignedTasks = (allTasks ?? [])
    .map((t) => ({ work_item_id: t.id, reference: t.reference, title: t.title, type: t.type, status: t.status }))

  // --- Sales activity auto-metrics ---
  let autoMetrics: Record<string, number> = {}
  if (caller.department === "sales") {
    const [actsRes, statusRes] = await Promise.all([
      admin
        .from("lead_activities")
        .select("type, lead_id")
        .eq("actor_id", caller.employeeId)
        .gte("created_at", startISO),
      admin
        .from("leads")
        .select("id, status")
        .eq("assigned_to", caller.employeeId)
        .in("status", ["site_visit", "won"])
        .gte("updated_at", startISO),
    ])

    let calls = 0, whatsapp = 0
    const leadSet = new Set<string>()
    for (const a of actsRes.data ?? []) {
      if (a.type === "call") calls++
      else if (a.type === "whatsapp") whatsapp++
      if (a.lead_id) leadSet.add(a.lead_id)
    }
    let site_visits = 0, deals = 0
    for (const l of statusRes.data ?? []) {
      if (l.status === "site_visit") site_visits++
      else if (l.status === "won") deals++
    }
    autoMetrics = { calls, whatsapp, leads_contacted: leadSet.size, site_visits, deals }
  }

  return NextResponse.json({ department: caller.department, autoMetrics, workItems, allAssignedTasks })
}
