import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { transcribeAndSummarize } from "@/lib/calls/transcribe"

export const maxDuration = 60

/**
 * POST /api/webhooks/exotel
 * Receives Exotel CDR callback after a call ends.
 * Updates call_logs with duration, disposition, and recording URL.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (query param)
    const webhookSecret = process.env.EXOTEL_WEBHOOK_SECRET
    if (webhookSecret) {
      const url = new URL(request.url)
      const secret = url.searchParams.get("secret")
      if (secret !== webhookSecret) {
        return NextResponse.json({ error: "Invalid webhook secret" }, { status: 403 })
      }
    }

    // Exotel sends form-encoded or JSON — handle both
    const contentType = request.headers.get("content-type") || ""
    let payload: Record<string, string>

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData()
      payload = Object.fromEntries(formData.entries()) as Record<string, string>
    } else {
      payload = await request.json()
    }

    const callSid = payload.CallSid || payload.callSid
    if (!callSid) {
      return NextResponse.json({ error: "Missing CallSid" }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    // Find the call_logs row
    const { data: callRow } = await admin
      .from("call_logs")
      .select("id, employee_id, lead_id, org_id, call_started_at")
      .eq("provider_call_id", callSid)
      .maybeSingle()

    if (!callRow) {
      console.warn("Exotel webhook: no call_logs row for CallSid", callSid)
      return NextResponse.json({ status: "ignored", reason: "call not found" })
    }

    // Map Exotel status to our disposition enum
    const exotelStatus = (payload.Status || payload.status || "").toLowerCase()
    const dispositionMap: Record<string, string> = {
      completed: "connected",
      "no-answer": "no_answer",
      busy: "busy",
      failed: "failed",
      canceled: "rejected",
    }
    const disposition = dispositionMap[exotelStatus] || "failed"

    const durationSeconds = parseInt(payload.Duration || payload.duration || "0", 10)
    const recordingUrl = payload.RecordingUrl || payload.recordingUrl || null

    // Parse timestamps
    const answeredAt = payload.StartTime || payload.startTime || null
    const endedAt = payload.EndTime || payload.endTime || null

    // Update call_logs
    await admin
      .from("call_logs")
      .update({
        duration_seconds: durationSeconds,
        disposition,
        recording_url: recordingUrl,
        answered_at: answeredAt,
        ended_at: endedAt,
      })
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

    // Trigger transcription if recording exists and call was connected
    if (recordingUrl && disposition === "connected") {
      after(async () => {
        try {
          await transcribeAndSummarize(callRow.id)
        } catch (err) {
          console.error("Transcription failed:", err)
        }
      })
    }

    return NextResponse.json({ status: "ok" })
  } catch (err) {
    console.error("Exotel webhook error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
