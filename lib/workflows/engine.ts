import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"

export type WorkflowTrigger =
  | "lead_created"
  | "lead_assigned"
  | "call_completed"
  | "call_missed"
  | "recording_processed"
  | "ai_high_intent"
  | "stage_changed"
  | "task_overdue"
  | "visit_completed"
  | "visit_cancelled"
  | "deal_value_changed"
  | "lead_untouched"
  | "no_activity"

interface WorkflowAction {
  type: string
  params: Record<string, unknown>
}

interface WorkflowRule {
  id: string
  org_id: string
  name: string
  trigger: string
  conditions: Record<string, unknown>
  actions: WorkflowAction[]
  priority: number
}

interface TriggerContext {
  orgId: string
  trigger: WorkflowTrigger
  entityType: string
  entityId: string
  data: Record<string, unknown>
  actorId?: string
}

/**
 * Fire a workflow trigger — find matching rules and execute actions.
 * All executions are logged to workflow_executions for audit.
 */
export async function fireTrigger(ctx: TriggerContext): Promise<void> {
  const admin = getSupabaseAdmin()

  // Find active rules matching this trigger
  const { data: rules } = await admin
    .from("workflow_rules")
    .select("*")
    .eq("org_id", ctx.orgId)
    .eq("trigger", ctx.trigger)
    .eq("is_active", true)
    .order("priority", { ascending: true })

  if (!rules || rules.length === 0) return

  for (const rule of rules as WorkflowRule[]) {
    // Check conditions
    if (!evaluateConditions(rule.conditions, ctx.data)) continue

    // Execute actions
    const actionResults: { type: string; status: string; error?: string }[] = []
    let overallStatus: "completed" | "partial" | "failed" = "completed"

    for (const action of rule.actions) {
      try {
        await executeAction(admin, ctx, action)
        actionResults.push({ type: action.type, status: "completed" })
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err)
        actionResults.push({ type: action.type, status: "failed", error: errorMsg })
        overallStatus = "partial"
        console.error(`workflow: action ${action.type} failed for rule ${rule.id}`, err)
      }
    }

    if (actionResults.every((r) => r.status === "failed")) {
      overallStatus = "failed"
    }

    // Log execution
    await admin.from("workflow_executions").insert({
      org_id: ctx.orgId,
      rule_id: rule.id,
      trigger_event: {
        trigger: ctx.trigger,
        entity_type: ctx.entityType,
        entity_id: ctx.entityId,
        data: ctx.data,
      },
      actions_taken: actionResults,
      status: overallStatus,
    })
  }
}

/** Evaluate rule conditions against trigger data. */
function evaluateConditions(
  conditions: Record<string, unknown>,
  data: Record<string, unknown>
): boolean {
  for (const [key, expected] of Object.entries(conditions)) {
    const actual = data[key]

    if (Array.isArray(expected)) {
      // Value must be in the array
      if (!expected.includes(actual)) return false
    } else if (typeof expected === "object" && expected !== null) {
      // Comparison operators: { gte: 100, lte: 500 }
      const ops = expected as Record<string, number>
      const numVal = Number(actual)
      if (ops.gte !== undefined && numVal < ops.gte) return false
      if (ops.lte !== undefined && numVal > ops.lte) return false
      if (ops.gt !== undefined && numVal <= ops.gt) return false
      if (ops.lt !== undefined && numVal >= ops.lt) return false
    } else {
      // Exact match
      if (actual !== expected) return false
    }
  }
  return true
}

/** Execute a single workflow action. */
async function executeAction(
  admin: ReturnType<typeof getSupabaseAdmin>,
  ctx: TriggerContext,
  action: WorkflowAction
): Promise<void> {
  switch (action.type) {
    case "create_task": {
      const assignTo = (action.params.assign_to as string) || ctx.actorId
      const dueOffset = (action.params.due_offset_hours as number) || 24
      await admin.from("work_items").insert({
        org_id: ctx.orgId,
        created_by: ctx.actorId || assignTo,
        assigned_to: assignTo,
        type: "task",
        title: action.params.title as string,
        description: (action.params.description as string) || null,
        status: "todo",
        priority: (action.params.priority as number) || 3,
        due_at: new Date(Date.now() + dueOffset * 60 * 60 * 1000).toISOString(),
        linked_lead_id: ctx.entityType === "lead" ? ctx.entityId : null,
        labels: ["workflow-generated"],
      })
      break
    }

    case "notify": {
      const role = action.params.role as string
      let recipientIds: string[] = []

      if (role === "manager" && ctx.actorId) {
        const { data: emp } = await admin
          .from("fs_employees")
          .select("reports_to")
          .eq("id", ctx.actorId)
          .maybeSingle()
        if (emp?.reports_to) recipientIds = [emp.reports_to]
      } else if (role === "admin") {
        const { data: admins } = await admin
          .from("fs_employees")
          .select("id")
          .eq("org_id", ctx.orgId)
          .eq("is_admin", true)
          .eq("is_active", true)
        recipientIds = (admins || []).map((a) => a.id)
      } else if (action.params.employee_id) {
        recipientIds = [action.params.employee_id as string]
      }

      for (const recipientId of recipientIds) {
        await admin.from("fs_notifications").insert({
          recipient_id: recipientId,
          type: "workflow_alert",
          title: (action.params.title as string) || "Workflow Alert",
          message: (action.params.message as string) || `Workflow triggered: ${ctx.trigger}`,
        })
      }
      break
    }

    case "change_stage": {
      if (ctx.entityType === "lead") {
        const newStage = action.params.to as string
        await admin
          .from("leads")
          .update({ status: newStage })
          .eq("id", ctx.entityId)

        await admin.from("lead_activities").insert({
          lead_id: ctx.entityId,
          actor_id: ctx.actorId || null,
          type: "status_change",
          body: `Status → ${newStage} (automated by workflow)`,
        })

        await logAudit({
          orgId: ctx.orgId,
          entity: "lead",
          entityId: ctx.entityId,
          action: "workflow_update",
          after: { status: newStage },
          source: "system",
        })
      }
      break
    }

    case "change_temperature": {
      if (ctx.entityType === "lead") {
        const newTemp = action.params.to as string
        await admin
          .from("leads")
          .update({ temperature: newTemp })
          .eq("id", ctx.entityId)
      }
      break
    }

    case "assign_to": {
      if (ctx.entityType === "lead") {
        const assigneeId = action.params.employee_id as string
        await admin
          .from("leads")
          .update({ assigned_to: assigneeId })
          .eq("id", ctx.entityId)
      }
      break
    }

    default:
      console.warn(`workflow: unknown action type: ${action.type}`)
  }
}
