import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { transcribeAndSummarize } from "@/lib/calls/transcribe"

export const maxDuration = 60

const BUCKET = "call-recordings"
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

/**
 * POST /api/calls/upload-recording
 * Accepts multipart/form-data with:
 *   - file: audio file (max 25 MB)
 *   - leadId: UUID of the lead this call is associated with
 *
 * Uploads to Supabase storage, inserts a call_logs row,
 * and fires off transcription in the background.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const leadId = (formData.get("leadId") as string | null)?.trim() || null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large (max 25 MB)" },
      { status: 400 },
    )
  }

  if (!leadId) {
    return NextResponse.json(
      { error: "leadId is required" },
      { status: 400 },
    )
  }

  const admin = getSupabaseAdmin()

  // Verify the lead belongs to the caller's org
  const { data: lead } = await admin
    .from("leads")
    .select("id, phone_e164")
    .eq("id", leadId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  // Upload file to Supabase storage
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "recording"
  const storagePath = `${caller.orgId}/${caller.employeeId}/${Date.now()}_${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "audio/mpeg",
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadError.message },
      { status: 500 },
    )
  }

  // Insert call_logs row
  const recordingUrl = `supabase://${BUCKET}/${storagePath}`

  const { data: callLog, error: insertErr } = await admin
    .from("call_logs")
    .insert({
      org_id: caller.orgId,
      employee_id: caller.employeeId,
      lead_id: leadId,
      client_number: lead.phone_e164 || "unknown",
      direction: "outbound",
      duration_seconds: 0,
      call_started_at: new Date().toISOString(),
      source: "manual_upload",
      ingest_source: "manual_upload",
      disposition: "connected",
      recording_url: recordingUrl,
    })
    .select("id")
    .single()

  if (insertErr) {
    // Clean up orphaned storage object
    await admin.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json(
      { error: "Failed to create call log: " + insertErr.message },
      { status: 500 },
    )
  }

  // Run transcription pipeline synchronously (maxDuration = 60s)
  try {
    await transcribeAndSummarize(callLog.id)
  } catch (err) {
    console.error("upload-recording: transcription failed", err)
  }

  return NextResponse.json(
    { callId: callLog.id, status: "processing" },
    { status: 201 },
  )
}
