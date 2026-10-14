import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * POST /api/webhooks/plivo/hangup
 * Receives Plivo callback after a call ends (hangup_url / recording callback).
 * Updates call_logs with duration, disposition, and recording URL.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (query param)
    const webhookSecret = process.env.PLIVO_WEBHOOK_SECRET
    if (webhookSecret) {
      const url = new URL(request.url)
      const secret = url.searchParams.get("secret")
      if (secret !== webhookSecret) {
        return NextResponse.json({ error: "Invalid webhook secret" }, { status: 403 })
      }
    }

    // Plivo sends form-encoded or JSON — handle both
    const contentType = request.headers.get("content-type") || ""
    let payload: Record<string, string>

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData()
      payload = Object.fromEntries(formData.entries()) as Record<string, string>
    } else {
      payload = await request.json()
    }

    // Log full payload for debugging
    console.log("Plivo hangup webhook payload:", JSON.stringify(payload))

    const callUuid = payload.CallUUID
    if (!callUuid) {
      return NextResponse.json({ error: "Missing CallUUID" }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Find the call_logs row by provider_call_id
    const { data: callRow } = await admin
      .from("call_logs")
      .select("id, employee_id, lead_id, org_id, call_started_at")
      .eq("provider_call_id", callUuid)
      .maybeSingle()

    if (!callRow) {
      console.warn("Plivo webhook: no call_logs row for CallUUID", callUuid)
      return NextResponse.json({ status: "ignored", reason: "call not found" })
    }

    // Map Plivo status to our disposition enum
    const plivoStatus = (payload.CallStatus || payload.Event || "").toLowerCase()
    const dispositionMap: Record<string, string> = {
      completed: "connected",
      "no-answer": "no_answer",
      busy: "busy",
      failed: "failed",
      canceled: "rejected",
    }
    const disposition = dispositionMap[plivoStatus] || "failed"

    const durationSeconds = parseInt(payload.Duration || payload.BillDuration || "0", 10)

    // Parse timestamps
    const answeredAt = payload.AnswerTime || payload.StartTime || null
    const endedAt = payload.EndTime || null

    // Do NOT set recording_url here. The hangup payload may include a
    // RecordUrl before Plivo has finished processing the recording file,
    // leading to 403 "Recording not found" errors. Only the dedicated
    // recording webhook (/api/webhooks/plivo/recording) should set
    // recording_url — it fires after the file is actually available.
    const updateFields: Record<string, unknown> = {
      duration_seconds: durationSeconds,
      disposition,
      answered_at: answeredAt,
      ended_at: endedAt,
    }

    // Update call_logs
    await admin
      .from("call_logs")
      .update(updateFields)
      .eq("id", callRow.id)

    // Match lead by phone if lead_id is null
    if (!callRow.lead_id) {
      const clientNumber = payload.To || payload.to
      if (clientNumber) {
        const { data: matchedLead } = await admin
          .from("leads")
          .select("id")
          .eq("org_id", callRow.org_id)
          .eq("phone_e164", clientNumber)
          .maybeSingle()

        if (matchedLead) {
          await admin
            .from("call_logs")
            .update({ lead_id: matchedLead.id })
            .eq("id", callRow.id)
        }
      }
    }

    // Recompute call_daily for the affected employee + date
    const callDate = callRow.call_started_at.split("T")[0]
    await admin.rpc("recompute_call_daily", {
      p_employee_id: callRow.employee_id,
      p_date: callDate,
    })

    return NextResponse.json({ status: "ok" })
  } catch (err) {
    console.error("Plivo webhook error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
