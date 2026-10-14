import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { notifyLeadEscalation } from "@/lib/push/send-push"

/**
 * POST /api/leads/escalation-check
 * Cron endpoint — checks for leads with no activity within 15 minutes of assignment
 * and escalates to managers + admins.
 * Schedule: *​/5 * * * * (every 5 minutes)
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const now = Date.now()

  // Window: leads created between 15 min and 24 hours ago
  const fifteenMinAgo = new Date(now - 15 * 60 * 1000).toISOString()
  const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  // Find candidate leads: assigned, not yet escalated, within the escalation window
  const { data: candidates } = await admin
    .from("leads")
    .select("id, full_name, assigned_to, org_id")
    .not("assigned_to", "is", null)
    .is("escalated_at", null)
    .lte("created_at", fifteenMinAgo)
    .gte("created_at", twentyFourHoursAgo)

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ message: "No leads to escalate" })
  }

  // Check which candidates have ANY lead_activities
  const candidateIds = candidates.map((c) => c.id)
  const { data: activities } = await admin
    .from("lead_activities")
    .select("lead_id")
    .in("lead_id", candidateIds)

  const respondedLeadIds = new Set((activities ?? []).map((a) => a.lead_id))

  // Filter to unresponded leads only
  const unresponded = candidates.filter((c) => !respondedLeadIds.has(c.id))

  if (unresponded.length === 0) {
    return NextResponse.json({ message: "All candidates have activity" })
  }

  // Group by org
  const orgLeads = new Map<string, typeof unresponded>()
  for (const lead of unresponded) {
    const list = orgLeads.get(lead.org_id) || []
    list.push(lead)
    orgLeads.set(lead.org_id, list)
  }

  const results: Record<string, number> = {}

  for (const [orgId, leads] of orgLeads) {
    // Collect unique assigned employee IDs for this org
    const assigneeIds = [...new Set(leads.map((l) => l.assigned_to!))]

    // Fetch admins + assigned employees (with their manager info) in batch
    const [adminsRes, assigneesRes] = await Promise.all([
      admin
        .from("fs_employees")
        .select("id, expo_push_token")
        .eq("org_id", orgId)
        .eq("is_active", true)
        .eq("is_admin", true),
      admin
        .from("fs_employees")
        .select("id, full_name, reports_to")
        .in("id", assigneeIds)
        .eq("is_active", true),
    ])

    const adminMap = new Map<string, string | null>()
    for (const a of adminsRes.data ?? []) {
      adminMap.set(a.id, a.expo_push_token)
    }

    // Build assignee name + manager lookup
    const assigneeInfo = new Map<string, { name: string; managerId: string | null }>()
    const managerIdsToFetch: string[] = []
    for (const emp of assigneesRes.data ?? []) {
      assigneeInfo.set(emp.id, { name: emp.full_name, managerId: emp.reports_to })
      if (emp.reports_to && !adminMap.has(emp.reports_to)) {
        managerIdsToFetch.push(emp.reports_to)
      }
    }

    // Fetch managers who aren't already admins
    const managerTokens = new Map<string, string | null>()
    if (managerIdsToFetch.length > 0) {
      const { data: managers } = await admin
        .from("fs_employees")
        .select("id, expo_push_token")
        .in("id", [...new Set(managerIdsToFetch)])
        .eq("is_active", true)

      for (const m of managers ?? []) {
        managerTokens.set(m.id, m.expo_push_token)
      }
    }

    // Send escalation notifications for each lead
    for (const lead of leads) {
      const info = assigneeInfo.get(lead.assigned_to!)
      const assigneeName = info?.name || "Unknown"

      // Build deduplicated recipient map: admins + manager
      const recipientMap = new Map<string, string | null>(adminMap)
      if (info?.managerId) {
        if (!recipientMap.has(info.managerId)) {
          recipientMap.set(info.managerId, managerTokens.get(info.managerId) ?? null)
        }
      }

      if (recipientMap.size === 0) continue

      await notifyLeadEscalation(
        admin,
        orgId,
        recipientMap,
        lead.id,
        lead.full_name,
        assigneeName,
      )
    }

    // Get the first active admin for reassignment
    const adminToReassign = adminsRes.data?.[0]

    // Batch-update escalated_at and reassign to admin for all escalated leads in this org
    const escalatedIds = leads.map((l) => l.id)
    const updatePayload: Record<string, string> = {
      escalated_at: new Date().toISOString(),
    }
    if (adminToReassign) {
      updatePayload.assigned_to = adminToReassign.id
    }
    await admin
      .from("leads")
      .update(updatePayload)
      .in("id", escalatedIds)

    // Log reassignment activity for each lead
    if (adminToReassign) {
      await admin.from("lead_activities").insert(
        leads.map((lead) => ({
          lead_id: lead.id,
          actor_id: null,
          type: "status_change" as const,
          body: `Auto-reassigned to admin — no employee response within 15 minutes`,
        }))
      )
    }

    results[orgId] = escalatedIds.length
  }

  return NextResponse.json({ success: true, escalated: results })
}
