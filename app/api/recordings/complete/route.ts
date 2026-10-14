import { NextRequest, NextResponse } from "next/server"
import { after } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { transcribeAndSummarize } from "@/lib/calls/transcribe"

export const maxDuration = 60

interface CompleteBody {
  recording_id: string
  duration_seconds?: number
  size_bytes?: number
}

/**
 * POST /api/recordings/complete
 * Mark upload done → transition to 'uploaded' → trigger transcription pipeline.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as CompleteBody

  if (!body.recording_id) {
    return NextResponse.json({ error: "recording_id is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Fetch recording
  const { data: recording } = await admin
    .from("recordings")
    .select("id, call_id, org_id, status, storage_key")
    .eq("id", body.recording_id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!recording) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 })
  }

  if (recording.status !== "uploading") {
    return NextResponse.json(
      { error: `Invalid state transition: ${recording.status} → uploaded` },
      { status: 400 }
    )
  }

  // Update recording status to 'uploaded'
  const updates: Record<string, unknown> = { status: "uploaded" }
  if (body.duration_seconds) updates.duration_seconds = body.duration_seconds
  if (body.size_bytes) updates.size_bytes = body.size_bytes

  const { error: updateError } = await admin
    .from("recordings")
    .update(updates)
    .eq("id", body.recording_id)

  if (updateError) {
    console.error("recording complete error:", updateError)
    return NextResponse.json({ error: "Failed to update recording" }, { status: 500 })
  }

  // Update call_logs recording status + recording_url for transcription
  if (recording.call_id) {
    await admin
      .from("call_logs")
      .update({
        recording_status: "uploaded",
        recording_url: recording.storage_key,
      })
      .eq("id", recording.call_id)

    // Update recording to 'transcribing' and fire transcription pipeline
    await admin
      .from("recordings")
      .update({ status: "transcribing" })
      .eq("id", body.recording_id)

    // Use after() so Vercel keeps the function alive until transcription completes
    after(async () => {
      try {
        await transcribeAndSummarize(recording.call_id)
      } catch (err) {
        console.error("transcription pipeline error:", err)
        admin
          .from("recordings")
          .update({ status: "failed", error_code: "transcription_failed", retry_count: 1 })
          .eq("id", body.recording_id)
      }
    })
  }

  // Increment usage meters
  if (body.duration_seconds) {
    const period = new Date().toISOString().slice(0, 7) + "-01" // first of month
    await admin.rpc("increment_usage_meter", {
      p_org_id: caller.orgId,
      p_period: period,
      p_field: "recording_minutes",
      p_value: body.duration_seconds / 60,
    }).catch(() => {
      // RPC may not exist yet — ignore
    })
  }

  return NextResponse.json({ success: true, status: "uploaded" })
}
