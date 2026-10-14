import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { transcribeAndSummarize } from "@/lib/calls/transcribe"

export const maxDuration = 60

/**
 * POST /api/webhooks/plivo/recording
 * Plivo hits this when a <Record> element captures a recording.
 * Updates call_logs with the recording URL and triggers transcription.
 *
 * Plivo sends: RecordUrl, RecordingID, RecordingDuration, CallUUID, etc.
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || ""
    let payload: Record<string, string>

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData()
      payload = Object.fromEntries(formData.entries()) as Record<string, string>
    } else {
      payload = await request.json()
    }

    console.log("Plivo recording webhook payload:", JSON.stringify(payload))

    const callUuid = payload.CallUUID
    const recordingUrl = payload.RecordUrl || payload.RecordingUrl

    if (!callUuid) {
      return NextResponse.json({ error: "Missing CallUUID" }, { status: 400 })
    }

    if (!recordingUrl) {
      console.warn("Plivo recording webhook: no RecordUrl in payload")
      return NextResponse.json({ status: "ignored", reason: "no recording URL" })
    }

    const admin = getSupabaseAdmin()

    const { data: callRow } = await admin
      .from("call_logs")
      .select("id")
      .eq("provider_call_id", callUuid)
      .maybeSingle()

    if (!callRow) {
      console.warn("Plivo recording webhook: no call_logs row for CallUUID", callUuid)
      return NextResponse.json({ status: "ignored", reason: "call not found" })
    }

    await admin
      .from("call_logs")
      .update({ recording_url: recordingUrl })
      .eq("id", callRow.id)

    console.log(`Plivo recording saved for call ${callRow.id}: ${recordingUrl}`)

    // Run transcription pipeline synchronously (maxDuration = 60s)
    try {
      await transcribeAndSummarize(callRow.id)
    } catch (err) {
      console.error("Transcription failed:", err)
    }

    return NextResponse.json({ status: "ok" })
  } catch (err) {
    console.error("Plivo recording webhook error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
