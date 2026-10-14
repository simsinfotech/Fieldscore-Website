import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * POST /api/leads/[id]/call-disposition
 * Submit a disposition for the most recent call to this lead.
 * If no recent call log exists, creates a minimal one.
 *
 * Body: { disposition, notes?, callback_at? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: leadId } = await params
  const body = await request.json()
  const { disposition, notes, callback_at } = body

  if (!disposition) {
    return NextResponse.json({ error: "disposition is required" }, { status: 400 })
  }

  const validDispositions = [
    "connected", "no_answer", "rejected", "busy", "failed",
    "interested", "not_interested", "callback", "invalid", "voicemail",
  ]
  if (!validDispositions.includes(disposition)) {
    return NextResponse.json({ error: `Invalid disposition: ${disposition}` }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify the lead exists and belongs to the same org
  const { data: lead } = await admin
    .from("leads")
    .select("id, org_id, full_name, phone_e164")
    .eq("id", leadId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  // Find the most recent call log for this lead (within the last 30 minutes)
  const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

  const { data: recentCall } = await admin
    .from("call_logs")
    .select("id")
    .eq("lead_id", leadId)
    .gte("call_started_at", thirtyMinAgo)
    .order("call_started_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let callLogId: string

  if (recentCall) {
    callLogId = recentCall.id
  } else {
    // No recent call found — create a minimal call log entry
    const { data: newCall, error: insertErr } = await admin
      .from("call_logs")
      .insert({
        org_id: caller.orgId,
        employee_id: caller.employeeId,
        lead_id: leadId,
        client_number: lead.phone_e164,
        direction: "outbound",
        duration_seconds: 0,
        call_started_at: new Date().toISOString(),
        ingest_source: "own_app",
      })
      .select("id")
      .single()

    if (insertErr || !newCall) {
      console.error("Failed to create call log:", insertErr)
      return NextResponse.json({ error: "Failed to create call log" }, { status: 500 })
    }
    callLogId = newCall.id
  }

  // Apply disposition to the call log
  const { error: updateErr } = await admin
    .from("call_logs")
    .update({ disposition })
    .eq("id", callLogId)

  if (updateErr) {
    console.error("Failed to update disposition:", updateErr)
    return NextResponse.json({ error: "Failed to save disposition" }, { status: 500 })
  }

  // Log activity on the lead if notes provided
  if (notes) {
    await admin.from("lead_activities").insert({
      org_id: caller.orgId,
      lead_id: leadId,
      employee_id: caller.employeeId,
      type: "call",
      content: `Disposition: ${disposition}. ${notes}`,
    }).then(() => {})
  }

  // Handle follow-up actions based on disposition
  if (disposition === "callback") {
    const dueAt = callback_at || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
    await admin.from("work_items").insert({
      org_id: caller.orgId,
      assigned_to: caller.employeeId,
      lead_id: leadId,
      type: "task",
      title: `Callback: ${lead.full_name}`,
      due_at: dueAt,
      status: "pending",
    }).then(() => {})
  } else if (disposition === "interested") {
    await admin.from("work_items").insert({
      org_id: caller.orgId,
      assigned_to: caller.employeeId,
      lead_id: leadId,
      type: "task",
      title: `Follow up: ${lead.full_name}`,
      due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      status: "pending",
    }).then(() => {})
  } else if (disposition === "invalid") {
    await admin.from("leads").update({ status: "junk" }).eq("id", leadId).then(() => {})
  }

  return NextResponse.json({ success: true, disposition, callLogId })
}
