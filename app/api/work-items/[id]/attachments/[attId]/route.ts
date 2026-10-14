import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

const BUCKET = "work-attachments"

type Caller = NonNullable<Awaited<ReturnType<typeof resolveEmployee>>>

async function canViewItem(
  caller: Caller,
  workItemId: string,
  admin: ReturnType<typeof getSupabaseAdmin>
) {
  const { data: item } = await admin
    .from("work_items")
    .select("created_by, assigned_to, watchers")
    .eq("id", workItemId)
    .eq("org_id", caller.orgId)
    .maybeSingle()
  if (!item) return false
  if (
    caller.isAdmin ||
    item.created_by === caller.employeeId ||
    item.assigned_to === caller.employeeId ||
    (item.watchers ?? []).includes(caller.employeeId)
  ) return true
  if (item.assigned_to) {
    const { data: vis } = await admin.rpc("visible_user_ids", { p_user: caller.employeeId })
    return (vis ?? []).some((v: { user_id: string }) => v.user_id === item.assigned_to)
  }
  return false
}

/**
 * GET — redirect to a short-lived signed URL (or the link).
 * `?inline=1` serves the file for inline display (image previews); the
 * default forces a download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, attId } = await params
  const inline = request.nextUrl.searchParams.get("inline") === "1"
  const admin = getSupabaseAdmin()

  const { data: att } = await admin
    .from("work_item_attachments")
    .select("id, work_item_id, kind, url, storage_path, file_name")
    .eq("id", attId)
    .eq("work_item_id", id)
    .maybeSingle()
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!(await canViewItem(caller, id, admin))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (att.kind === "link") {
    return NextResponse.redirect(att.url as string)
  }

  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(
      att.storage_path as string,
      60,
      inline ? undefined : { download: att.file_name }
    )
  if (error || !signed) {
    return NextResponse.json({ error: "Could not create download link" }, { status: 500 })
  }
  return NextResponse.redirect(signed.signedUrl)
}

/** DELETE — uploader or admin. Removes the storage object too. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, attId } = await params
  const admin = getSupabaseAdmin()

  const { data: att } = await admin
    .from("work_item_attachments")
    .select("id, uploaded_by, kind, storage_path")
    .eq("id", attId)
    .eq("work_item_id", id)
    .maybeSingle()
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (!caller.isAdmin && att.uploaded_by !== caller.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (att.kind === "file" && att.storage_path) {
    await admin.storage.from(BUCKET).remove([att.storage_path as string])
  }
  const { error } = await admin.from("work_item_attachments").delete().eq("id", attId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
