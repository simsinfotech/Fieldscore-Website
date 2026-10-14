import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { ExtractionResult } from "./extract"

const ACTION_TYPE_TO_TITLE: Record<string, string> = {
  CALL_BACK: "Call back lead",
  SEND_PROPERTIES: "Send matching properties",
  SCHEDULE_VISIT: "Schedule site visit",
  SEND_DOCUMENT: "Send requested document",
  FOLLOW_UP: "Follow up with lead",
}

/**
 * Create work_items tasks from AI extraction next_action.
 * Deduplicates: won't create if similar task already exists for lead + type + due window.
 */
export async function createAITasks(
  callId: string,
  leadId: string,
  orgId: string,
  employeeId: string,
  extraction: ExtractionResult
): Promise<string | null> {
  const nextAction = extraction.next_action
  if (!nextAction || nextAction.type === "NONE" || !nextAction.type) {
    return null
  }

  const admin = getSupabaseAdmin()

  // Compute due date from hint
  const dueAt = parseDueHint(nextAction.due_hint)

  // Dedup: check if similar task already exists for this lead
  const dedupeWindowStart = new Date(dueAt.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const dedupeWindowEnd = new Date(dueAt.getTime() + 24 * 60 * 60 * 1000).toISOString()

  const { data: existingTasks } = await admin
    .from("work_items")
    .select("id")
    .eq("linked_lead_id", leadId)
    .eq("assigned_to", employeeId)
    .neq("status", "done")
    .gte("due_at", dedupeWindowStart)
    .lte("due_at", dedupeWindowEnd)
    .limit(1)

  if (existingTasks && existingTasks.length > 0) {
    return null // Similar task already exists
  }

  // Build task title and description
  const title = ACTION_TYPE_TO_TITLE[nextAction.type] || nextAction.type
  const description = nextAction.description || `AI-generated from call analysis`

  const { data: task, error } = await admin
    .from("work_items")
    .insert({
      org_id: orgId,
      created_by: employeeId,
      assigned_to: employeeId,
      type: "task",
      title,
      description: `${description}\n\n[Auto-created by AI from call analysis]`,
      status: "todo",
      priority: extraction.signals?.intent === "high" ? 2 : 3,
      due_at: dueAt.toISOString(),
      linked_lead_id: leadId,
      labels: ["ai-generated"],
    })
    .select("id")
    .single()

  if (error) {
    console.error("task-creator: failed to create task", error)
    return null
  }

  // Notify the assignee
  await admin.from("fs_notifications").insert({
    recipient_id: employeeId,
    type: "work_assigned",
    title: "AI Task Created",
    message: `New task: "${title}" — auto-created from call analysis`,
    link: "/work",
  })

  return task.id
}

/** Parse a natural language due hint into a Date. */
function parseDueHint(hint: string | null | undefined): Date {
  const now = new Date()

  if (!hint) {
    // Default: tomorrow at 10am
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)
    return tomorrow
  }

  const lower = hint.toLowerCase()

  if (lower.includes("today")) {
    const today = new Date(now)
    today.setHours(17, 0, 0, 0) // End of day
    return today
  }

  if (lower.includes("tomorrow")) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    // Extract time if mentioned
    const timeMatch = lower.match(/(\d{1,2})\s*(am|pm)/i)
    if (timeMatch) {
      let hour = parseInt(timeMatch[1], 10)
      if (timeMatch[2].toLowerCase() === "pm" && hour < 12) hour += 12
      if (timeMatch[2].toLowerCase() === "am" && hour === 12) hour = 0
      tomorrow.setHours(hour, 0, 0, 0)
    } else {
      tomorrow.setHours(10, 0, 0, 0)
    }
    return tomorrow
  }

  if (lower.includes("next week")) {
    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)
    nextWeek.setHours(10, 0, 0, 0)
    return nextWeek
  }

  const daysMatch = lower.match(/in\s+(\d+)\s+day/i)
  if (daysMatch) {
    const days = parseInt(daysMatch[1], 10)
    const future = new Date(now)
    future.setDate(future.getDate() + days)
    future.setHours(10, 0, 0, 0)
    return future
  }

  const hoursMatch = lower.match(/in\s+(\d+)\s+hour/i)
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1], 10)
    return new Date(now.getTime() + hours * 60 * 60 * 1000)
  }

  // Default: tomorrow 10am
  const fallback = new Date(now)
  fallback.setDate(fallback.getDate() + 1)
  fallback.setHours(10, 0, 0, 0)
  return fallback
}
