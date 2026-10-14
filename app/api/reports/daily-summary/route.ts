import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { notifyDailySummary } from "@/lib/push/send-push"

/**
 * POST /api/reports/daily-summary
 * Cron endpoint — sends admins a daily summary of each employee's sales metrics.
 * Schedule: 0 15 * * * (15:00 UTC = 8:30 PM IST)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  // IST day boundaries
  const IST_OFFSET = 330 * 60000
  const istMidnight = new Date(Date.now() + IST_OFFSET)
  istMidnight.setUTCHours(0, 0, 0, 0)
  const startISO = new Date(istMidnight.getTime() - IST_OFFSET).toISOString()
  const endISO = new Date(istMidnight.getTime() - IST_OFFSET + 86400000).toISOString()

  // Fetch all active employees grouped by org
  const { data: allEmployees } = await admin
    .from("fs_employees")
    .select("id, org_id, full_name, is_admin, expo_push_token")
    .eq("is_active", true)

  if (!allEmployees || allEmployees.length === 0) {
    return NextResponse.json({ message: "No active employees" })
  }

  // Group employees by org
  const orgMap = new Map<string, typeof allEmployees>()
  for (const emp of allEmployees) {
    const list = orgMap.get(emp.org_id) || []
    list.push(emp)
    orgMap.set(emp.org_id, list)
  }

  const results: Record<string, { admins: number; employees: number }> = {}

  for (const [orgId, employees] of orgMap) {
    const admins = employees.filter((e) => e.is_admin)
    if (admins.length === 0) continue

    const employeeIds = employees.map((e) => e.id)

    // Batch-query lead_activities for all employees in this org today
    const [actsRes, statusRes] = await Promise.all([
      admin
        .from("lead_activities")
        .select("type, lead_id, actor_id")
        .in("actor_id", employeeIds)
        .gte("created_at", startISO)
        .lt("created_at", endISO),
      admin
        .from("leads")
        .select("id, status, assigned_to")
        .in("assigned_to", employeeIds)
        .in("status", ["site_visit", "won"])
        .gte("updated_at", startISO)
        .lt("updated_at", endISO),
    ])

    // Aggregate per-employee metrics
    const metrics = new Map<
      string,
      { calls: number; whatsapp: number; leadSet: Set<string>; site_visits: number; deals: number }
    >()

    for (const a of actsRes.data ?? []) {
      if (!metrics.has(a.actor_id)) {
        metrics.set(a.actor_id, { calls: 0, whatsapp: 0, leadSet: new Set(), site_visits: 0, deals: 0 })
      }
      const m = metrics.get(a.actor_id)!
      if (a.type === "call") m.calls++
      else if (a.type === "whatsapp") m.whatsapp++
      if (a.lead_id) m.leadSet.add(a.lead_id)
    }

    for (const l of statusRes.data ?? []) {
      if (!l.assigned_to) continue
      if (!metrics.has(l.assigned_to)) {
        metrics.set(l.assigned_to, { calls: 0, whatsapp: 0, leadSet: new Set(), site_visits: 0, deals: 0 })
      }
      const m = metrics.get(l.assigned_to)!
      if (l.status === "site_visit") m.site_visits++
      else if (l.status === "won") m.deals++
    }

    // Skip orgs with zero activity
    if (metrics.size === 0) continue

    // Build per-employee breakdown and org totals
    const totals = { calls: 0, whatsapp: 0, leads_contacted: 0, site_visits: 0, deals: 0 }
    const lines: string[] = []

    // Create a name lookup
    const nameMap = new Map(employees.map((e) => [e.id, e.full_name]))

    for (const [empId, m] of metrics) {
      const name = nameMap.get(empId) || "Unknown"
      const leadsContacted = m.leadSet.size
      lines.push(`${name}: ${m.calls} calls, ${m.whatsapp} WA, ${leadsContacted} leads, ${m.site_visits} visits, ${m.deals} deals`)
      totals.calls += m.calls
      totals.whatsapp += m.whatsapp
      totals.leads_contacted += leadsContacted
      totals.site_visits += m.site_visits
      totals.deals += m.deals
    }

    const breakdown = lines.join("\n")

    await notifyDailySummary(
      admin,
      orgId,
      admins.map((a) => ({ id: a.id, expo_push_token: a.expo_push_token })),
      breakdown,
      totals,
    )

    results[orgId] = { admins: admins.length, employees: metrics.size }
  }

  return NextResponse.json({ success: true, results })
}
