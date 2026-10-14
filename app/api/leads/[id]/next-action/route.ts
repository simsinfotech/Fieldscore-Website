import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/leads/[id]/next-action
 * Next-Best-Action engine — what should the rep do next, with reasons.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: leadId } = await params
  const admin = getSupabaseAdmin()

  // Fetch lead with context
  const { data: lead } = await admin
    .from("leads")
    .select("id, full_name, status, temperature, configuration, budget_max, " +
            "preferred_locations, ai_buyer_profile, updated_at, assigned_to")
    .eq("id", leadId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const reasons: string[] = []
  let actionType = "FOLLOW_UP"
  let actionTitle = "Follow up with lead"
  let priority = 3

  // Check last call
  const { data: lastCall } = await admin
    .from("call_logs")
    .select("id, call_started_at, duration_seconds, disposition")
    .eq("lead_id", leadId)
    .order("call_started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Check last AI analysis
  const { data: lastAnalysis } = await admin
    .from("ai_analyses")
    .select("signals, next_action, confidence")
    .eq("call_id", lastCall?.id || "00000000-0000-0000-0000-000000000000")
    .maybeSingle()

  // Check pending tasks
  const { data: pendingTasks } = await admin
    .from("work_items")
    .select("id, title, status, due_at")
    .eq("linked_lead_id", leadId)
    .neq("status", "done")
    .order("due_at", { ascending: true })
    .limit(3)

  const profile = (lead.ai_buyer_profile || {}) as Record<string, unknown>
  const promises = (profile.promises || {}) as { by_rep?: string[]; by_customer?: string[] }
  const now = Date.now()

  // --- Priority signals ---

  // 1. AI-extracted next action
  if (lastAnalysis?.next_action) {
    const nextAction = lastAnalysis.next_action as { type: string; description: string }
    actionType = nextAction.type
    actionTitle = nextAction.description || nextAction.type
    reasons.push("AI-recommended action from last conversation")
    priority = 2
  }

  // 2. Unfulfilled promises
  if (promises.by_rep && promises.by_rep.length > 0) {
    reasons.push(`Unfulfilled promise: "${promises.by_rep[0]}"`)
    priority = Math.min(priority, 2)
  }

  // 3. High-intent signal
  const intent = (lastAnalysis?.signals as Record<string, unknown>)?.intent
  if (intent === "high") {
    reasons.push("High-intent conversation detected")
    priority = 1
    if (actionType === "FOLLOW_UP") {
      actionType = "CALL_BACK"
      actionTitle = `Call ${lead.full_name} — high intent`
    }
  }

  // 4. No recent activity
  const daysSinceUpdate = (now - new Date(lead.updated_at).getTime()) / (1000 * 60 * 60 * 24)
  if (daysSinceUpdate > 3) {
    reasons.push(`No activity for ${Math.floor(daysSinceUpdate)} days`)
    priority = Math.min(priority, 2)
  }

  // 5. Overdue tasks
  const overdueTasks = (pendingTasks || []).filter(
    (t) => t.due_at && new Date(t.due_at) < new Date()
  )
  if (overdueTasks.length > 0) {
    reasons.push(`${overdueTasks.length} overdue task(s)`)
    priority = 1
  }

  // 6. Hot lead without follow-up
  if (lead.temperature === "hot" && !lastCall) {
    reasons.push("Hot lead — never called")
    actionType = "CALL_BACK"
    actionTitle = `First call to hot lead: ${lead.full_name}`
    priority = 1
  }

  // 7. Missed last call
  if (lastCall?.disposition === "no_answer") {
    reasons.push("Last call was missed — try again")
    actionType = "CALL_BACK"
    priority = Math.min(priority, 2)
  }

  // 8. Site visit stage without scheduled visit
  if (lead.status === "site_visit_planned") {
    const { data: events } = await admin
      .from("calendar_events")
      .select("id")
      .eq("lead_id", leadId)
      .eq("event_type", "site_visit")
      .eq("status", "scheduled")
      .limit(1)

    if (!events || events.length === 0) {
      reasons.push("Site visit planned but not yet scheduled")
      actionType = "SCHEDULE_VISIT"
      actionTitle = "Schedule site visit"
      priority = 1
    }
  }

  return NextResponse.json({
    lead_id: leadId,
    lead_name: lead.full_name,
    action: {
      type: actionType,
      title: actionTitle,
      priority,
    },
    reasons,
    context: {
      temperature: lead.temperature,
      status: lead.status,
      last_call: lastCall
        ? {
            date: lastCall.call_started_at,
            duration: lastCall.duration_seconds,
            disposition: lastCall.disposition,
          }
        : null,
      pending_tasks: (pendingTasks || []).length,
      days_since_activity: Math.floor(daysSinceUpdate),
    },
  })
}
