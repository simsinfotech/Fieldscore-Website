import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

interface InitBody {
  call_id: string
  filename: string
  content_type?: string
  size_bytes?: number
  codec?: string
  checksum?: string
}

/**
 * POST /api/recordings/init
 * Create upload session — returns signed URL for direct upload.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as InitBody

  if (!body.call_id || !body.filename) {
    return NextResponse.json(
      { error: "call_id and filename are required" },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Verify call belongs to caller's org
  const { data: call } = await admin
    .from("call_logs")
    .select("id, org_id, employee_id")
    .eq("id", body.call_id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!call) return NextResponse.json({ error: "Call not found" }, { status: 404 })

  // Check for existing recording (dedup by checksum)
  if (body.checksum) {
    const { data: existing } = await admin
      .from("recordings")
      .select("id")
      .eq("checksum", body.checksum)
      .eq("org_id", caller.orgId)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { error: "Recording already exists", recordingId: existing.id },
        { status: 409 }
      )
    }
  }

  // Generate storage path
  const now = new Date()
  const monthFolder = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const ext = body.filename.split(".").pop() || "mp3"
  const storageKey = `${caller.orgId}/${monthFolder}/${body.call_id}.${ext}`

  // Create recording row with status = 'uploading'
  const { data: recording, error: insertError } = await admin
    .from("recordings")
    .insert({
      org_id: caller.orgId,
      call_id: body.call_id,
      storage_key: `supabase://call-recordings/${storageKey}`,
      size_bytes: body.size_bytes || null,
      codec: body.codec || ext,
      checksum: body.checksum || null,
      status: "uploading",
    })
    .select("id")
    .single()

  if (insertError) {
    console.error("recording init error:", insertError)
    return NextResponse.json({ error: "Failed to create recording" }, { status: 500 })
  }

  // Update call_logs recording status
  await admin
    .from("call_logs")
    .update({ recording_status: "uploading" })
    .eq("id", body.call_id)

  // Create signed upload URL (1 hour expiry)
  const { data: signedUrl, error: signError } = await admin.storage
    .from("call-recordings")
    .createSignedUploadUrl(storageKey)

  if (signError) {
    console.error("signed url error:", signError)
    // Roll back recording status
    await admin.from("recordings").update({ status: "failed", error_code: "signed_url_failed" }).eq("id", recording.id)
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 })
  }

  return NextResponse.json({
    recordingId: recording.id,
    uploadUrl: signedUrl.signedUrl,
    storageKey,
  }, { status: 201 })
}
