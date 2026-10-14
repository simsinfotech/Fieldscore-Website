import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

const BUCKET = "call-recordings"

/**
 * DELETE /api/calls/delete-recording
 * Body JSON: { callId: string }
 *
 * Deletes a manually-uploaded call log and its storage object.
 * Only the employee who uploaded it (same org) can delete.
 */
export async function DELETE(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { callId } = (await request.json()) as { callId?: string }
  if (!callId) {
    return NextResponse.json({ error: "callId is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Fetch the call log — must belong to caller's org and be a manual upload
  const { data: call } = await admin
    .from("call_logs")
    .select("id, recording_url, source, org_id, employee_id")
    .eq("id", callId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 })
  }

  if (call.source !== "manual_upload") {
    return NextResponse.json(
      { error: "Only manually uploaded recordings can be deleted" },
      { status: 403 },
    )
  }

  // Delete storage object if it exists
  if (call.recording_url?.startsWith(`supabase://${BUCKET}/`)) {
    const storagePath = call.recording_url.replace(`supabase://${BUCKET}/`, "")
    await admin.storage.from(BUCKET).remove([storagePath])
  }

  // Delete the call log row
  const { error: deleteErr } = await admin
    .from("call_logs")
    .delete()
    .eq("id", callId)

  if (deleteErr) {
    return NextResponse.json(
      { error: "Failed to delete: " + deleteErr.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ deleted: true })
}
