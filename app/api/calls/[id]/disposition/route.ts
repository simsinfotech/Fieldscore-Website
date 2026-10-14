import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"

const VALID_DISPOSITIONS = [
  "connected", "no_answer", "rejected", "busy", "failed",
  "interested", "not_interested", "callback", "invalid", "voicemail",
]

interface DispositionBody {
  disposition: string
  notes?: string
  callback_at?: string // ISO timestamp for callback scheduling
}

/**
 * POST /api/calls/[id]/disposition
 * Save call outcome + trigger retry/follow-up rules.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: callId } = await params
  const body = (await request.json()) as DispositionBody

  if (!body.disposition || !VALID_DISPOSITIONS.includes(body.disposition)) {
    return NextResponse.json(
      { error: `disposition must be one of: ${VALID_DISPOSITIONS.join(", ")}` },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Verify call belongs to caller
  const { data: call } = await admin
    .from("call_logs")
    .select("id, employee_id, lead_id, org_id, disposition")
    .eq("id", callId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 })

  if (call.employee_id !== caller.employeeId && !caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Update disposition
  const { error: updateError } = await admin
    .from("call_logs")
    .update({ disposition: body.disposition })
    .eq("id", callId)

  if (updateError) {
    console.error("disposition update error:", updateError)
    return NextResponse.json({ error: "Failed to update disposition" }, { status: 500 })
  }

  // Add notes as lead activity if lead exists
  if (call.lead_id && body.notes) {
    await admin.from("lead_activities").insert({
      lead_id: call.lead_id,
      actor_id: caller.employeeId,
      type: "call",
      body: `Call disposition: ${body.disposition}. ${body.notes}`,
    })
  }

  // Create follow-up work items based on disposition
  if (call.lead_id) {
    switch (body.disposition) {
      case "callback": {
        const dueAt = body.callback_at || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
        await admin.from("work_items").insert({
          org_id: caller.orgId,
          created_by: caller.employeeId,
          assigned_to: caller.employeeId,
          type: "task",
          title: "Callback requested",
          description: body.notes || "Lead requested a callback",
          status: "todo",
          priority: 2,
          due_at: dueAt,
          linked_lead_id: call.lead_id,
        })
        break
      }
      case "interested": {
        await admin.from("work_items").insert({
          org_id: caller.orgId,
          created_by: caller.employeeId,
          assigned_to: caller.employeeId,
          type: "task",
          title: "Follow up with interested lead",
          status: "todo",
          priority: 2,
          due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          linked_lead_id: call.lead_id,
        })
        break
      }
      case "no_answer": {
        // Check retry count — max 3 attempts for no_answer
        const { count } = await admin
          .from("call_logs")
          .select("id", { count: "exact", head: true })
          .eq("lead_id", call.lead_id)
          .eq("employee_id", caller.employeeId)
          .eq("disposition", "no_answer")

        if ((count || 0) < 3) {
          await admin.from("work_items").insert({
            org_id: caller.orgId,
            created_by: caller.employeeId,
            assigned_to: caller.employeeId,
            type: "task",
            title: "Retry call — no answer",
            status: "todo",
            priority: 3,
            due_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
            linked_lead_id: call.lead_id,
          })
        }
        break
      }
      case "invalid": {
        await admin
          .from("leads")
          .update({ status: "junk" })
          .eq("id", call.lead_id)
        break
      }
    }
  }

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "call_log",
    entityId: callId,
    action: "disposition",
    before: { disposition: call.disposition },
    after: { disposition: body.disposition },
    source: "manual",
  })

  return NextResponse.json({ success: true, disposition: body.disposition })
}
