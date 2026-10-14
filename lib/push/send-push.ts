import type { SupabaseClient } from "@supabase/supabase-js"

interface PushMessage {
  to: string
  title: string
  body: string
  data?: Record<string, unknown>
  channelId?: string
}

/**
 * Send push notifications via the Expo Push API.
 * Accepts an array of messages and sends them in a single batch.
 */
async function sendExpoPush(messages: PushMessage[]): Promise<void> {
  if (messages.length === 0) return

  const res = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.error("[push] Expo push failed:", res.status, text)
  }
}

/**
 * Notify all employees in an org about new leads from sheet sync.
 * Creates fs_notifications entries and sends push notifications.
 */
export async function notifyNewLeads(
  admin: SupabaseClient,
  orgId: string,
  newLeads: { id: string; full_name: string }[],
): Promise<void> {
  if (newLeads.length === 0) return

  // Fetch all active employees in this org who have a push token
  const { data: employees } = await admin
    .from("fs_employees")
    .select("id, expo_push_token")
    .eq("org_id", orgId)
    .eq("is_active", true)

  if (!employees || employees.length === 0) return

  const now = new Date().toISOString()
  const leadCount = newLeads.length
  const title = "New Lead" + (leadCount > 1 ? "s" : "")
  const body =
    leadCount === 1
      ? `${newLeads[0].full_name} — new lead from Google Sheets`
      : `${leadCount} new leads synced from Google Sheets`

  // Create in-app notification for every employee
  const notifications = employees.map((emp) => ({
    recipient_id: emp.id,
    type: "lead_new" as const,
    title,
    message: body,
    is_read: false,
    created_at: now,
  }))

  await admin.from("fs_notifications").insert(notifications)

  // Send push notifications to employees who have a token
  const pushMessages: PushMessage[] = employees
    .filter((emp) => emp.expo_push_token)
    .map((emp) => ({
      to: emp.expo_push_token!,
      title,
      body,
      data:
        leadCount === 1 ? { leadId: newLeads[0].id } : { count: leadCount },
      channelId: "new-leads",
    }))

  await sendExpoPush(pushMessages).catch(() => {
    // Push delivery is best-effort — don't fail the sync
  })
}

/**
 * Notify admins and the employee's manager about a new call transcript.
 * Creates fs_notifications entries and sends push notifications.
 */
export async function notifyCallTranscript(
  admin: SupabaseClient,
  orgId: string,
  employeeId: string,
  leadName: string,
  summary: string,
  leadId: string | null,
): Promise<void> {
  // Fetch the calling employee's details (name + manager)
  const { data: caller } = await admin
    .from("fs_employees")
    .select("id, full_name, reports_to")
    .eq("id", employeeId)
    .single()

  const callerName = caller?.full_name || "An employee"

  // Fetch admins + the employee's manager (deduplicated)
  const { data: admins } = await admin
    .from("fs_employees")
    .select("id, expo_push_token")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .eq("is_admin", true)

  const recipientMap = new Map<string, string | null>()

  // Add admins
  for (const a of admins || []) {
    recipientMap.set(a.id, a.expo_push_token)
  }

  // Add manager if not already an admin
  if (caller?.reports_to && !recipientMap.has(caller.reports_to)) {
    const { data: manager } = await admin
      .from("fs_employees")
      .select("id, expo_push_token")
      .eq("id", caller.reports_to)
      .eq("is_active", true)
      .maybeSingle()

    if (manager) {
      recipientMap.set(manager.id, manager.expo_push_token)
    }
  }

  if (recipientMap.size === 0) return

  const now = new Date().toISOString()
  const title = "Call Transcript Ready"
  const body =
    summary.length > 120
      ? `${callerName} → ${leadName}: ${summary.slice(0, 100)}…`
      : `${callerName} → ${leadName}: ${summary}`

  // Create in-app notifications
  const notifications = Array.from(recipientMap.keys()).map((recipientId) => ({
    recipient_id: recipientId,
    type: "call_transcript" as const,
    title,
    message: body,
    link: leadId ? `/leads/${leadId}` : null,
    is_read: false,
    created_at: now,
  }))

  await admin.from("fs_notifications").insert(notifications)

  // Send push notifications
  const pushMessages: PushMessage[] = Array.from(recipientMap.entries())
    .filter(([, token]) => token)
    .map(([, token]) => ({
      to: token!,
      title,
      body,
      data: leadId ? { leadId } : {},
      channelId: "call-transcripts",
    }))

  await sendExpoPush(pushMessages).catch(() => {})
}

/**
 * Notify the employee about auto-created tasks from a call transcript.
 * Creates fs_notifications entry and sends push notification to the employee.
 */
export async function notifyAutoTasks(
  admin: SupabaseClient,
  employeeId: string,
  orgId: string,
  leadName: string,
  taskTitles: string[],
  leadId: string,
): Promise<void> {
  if (taskTitles.length === 0) return

  const { data: employee } = await admin
    .from("fs_employees")
    .select("id, expo_push_token")
    .eq("id", employeeId)
    .eq("is_active", true)
    .maybeSingle()

  if (!employee) return

  const now = new Date().toISOString()
  const title =
    taskTitles.length === 1
      ? "Task Created from Call"
      : `${taskTitles.length} Tasks Created from Call`
  const body =
    taskTitles.length === 1
      ? `"${taskTitles[0]}" — from your call with ${leadName}`
      : `"${taskTitles[0]}" + ${taskTitles.length - 1} more — from your call with ${leadName}`

  // Create in-app notification
  await admin.from("fs_notifications").insert({
    recipient_id: employeeId,
    type: "task_auto_created",
    title,
    message: body,
    link: `/leads/${leadId}`,
    is_read: false,
    created_at: now,
  })

  // Send push notification
  if (employee.expo_push_token) {
    await sendExpoPush([
      {
        to: employee.expo_push_token,
        title,
        body,
        data: { leadId, source: "call_transcript" },
        channelId: "auto-tasks",
      },
    ]).catch(() => {})
  }
}

/**
 * Notify admins with a daily sales report summary for their org.
 * Creates fs_notifications entries and sends push notifications.
 */
export async function notifyDailySummary(
  admin: SupabaseClient,
  orgId: string,
  admins: { id: string; expo_push_token: string | null }[],
  breakdown: string,
  totals: { calls: number; whatsapp: number; leads_contacted: number; site_visits: number; deals: number },
): Promise<void> {
  if (admins.length === 0) return

  const now = new Date().toISOString()
  const title = "Daily Sales Report"
  const pushBody = `Daily Report: ${totals.calls} calls, ${totals.whatsapp} WA, ${totals.leads_contacted} leads, ${totals.site_visits} visits, ${totals.deals} deals`

  // Create in-app notifications with full breakdown
  const notifications = admins.map((a) => ({
    recipient_id: a.id,
    type: "daily_report" as const,
    title,
    message: breakdown,
    is_read: false,
    created_at: now,
  }))

  await admin.from("fs_notifications").insert(notifications)

  // Send push notifications (short summary)
  const pushMessages: PushMessage[] = admins
    .filter((a) => a.expo_push_token)
    .map((a) => ({
      to: a.expo_push_token!,
      title,
      body: pushBody,
      data: { source: "daily_report" },
      channelId: "daily-reports",
    }))

  await sendExpoPush(pushMessages).catch(() => {})
}

/**
 * Notify admins and the assigned employee's manager about an unresponded lead.
 * Creates fs_notifications entries and sends push notifications.
 */
export async function notifyLeadEscalation(
  admin: SupabaseClient,
  orgId: string,
  recipientMap: Map<string, string | null>,
  leadId: string,
  leadName: string,
  assigneeName: string,
): Promise<void> {
  if (recipientMap.size === 0) return

  const now = new Date().toISOString()
  const title = "Lead Response Overdue"
  const body = `${leadName} (assigned to ${assigneeName}) has no response after 15 min`

  // Create in-app notifications
  const notifications = Array.from(recipientMap.keys()).map((recipientId) => ({
    recipient_id: recipientId,
    type: "lead_escalation" as const,
    title,
    message: body,
    link: `/leads/${leadId}`,
    is_read: false,
    created_at: now,
  }))

  await admin.from("fs_notifications").insert(notifications)

  // Send push notifications
  const pushMessages: PushMessage[] = Array.from(recipientMap.entries())
    .filter(([, token]) => token)
    .map(([, token]) => ({
      to: token!,
      title,
      body,
      data: { leadId },
      channelId: "lead-escalation",
    }))

  await sendExpoPush(pushMessages).catch(() => {})
}
