import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

const BUCKET = "work-attachments"
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

type Caller = NonNullable<Awaited<ReturnType<typeof resolveEmployee>>>

/** Load the work item and confirm the caller may see it. */
async function loadVisibleItem(
  caller: Caller,
  id: string,
  admin: ReturnType<typeof getSupabaseAdmin>
) {
  const { data: item } = await admin
    .from("work_items")
    .select("id, org_id, created_by, assigned_to, watchers")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()
  if (!item) return { item: null, canView: false }

  let canView =
    caller.isAdmin ||
    item.created_by === caller.employeeId ||
    item.assigned_to === caller.employeeId ||
    (item.watchers ?? []).includes(caller.employeeId)
  if (!canView && item.assigned_to) {
    const { data: vis } = await admin.rpc("visible_user_ids", { p_user: caller.employeeId })
    canView = (vis ?? []).some((v: { user_id: string }) => v.user_id === item.assigned_to)
  }
  return { item, canView }
}

/** GET /api/work-items/[id]/attachments — list. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()
  const { item, canView } = await loadVisibleItem(caller, id, admin)
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: attachments, error } = await admin
    .from("work_item_attachments")
    .select("*, uploader:fs_employees!work_item_attachments_uploaded_by_fkey(id, full_name)")
    .eq("work_item_id", id)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ attachments: attachments ?? [] })
}

/**
 * POST /api/work-items/[id]/attachments
 *  - multipart/form-data with `file`  → upload a file
 *  - JSON { url, label }               → attach a link
 * Anyone who can see the item may attach (admin sends files, assignee
 * attaches their work).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()
  const { item, canView } = await loadVisibleItem(caller, id, admin)
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const contentType = request.headers.get("content-type") || ""

  // ---- Link attachment ----
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => ({}))
    const url = (body.url || "").trim()
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 })
    let normalized = url
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`

    const { data: att, error } = await admin
      .from("work_item_attachments")
      .insert({
        work_item_id: id,
        org_id: caller.orgId,
        uploaded_by: caller.employeeId,
        kind: "link",
        file_name: (body.label || url).trim().slice(0, 200),
        url: normalized,
      })
      .select("*, uploader:fs_employees!work_item_attachments_uploaded_by_fkey(id, full_name)")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ attachment: att }, { status: 201 })
  }

  // ---- File attachment ----
  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 25 MB)" }, { status: 400 })
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file"
  const storagePath = `${caller.orgId}/${id}/${Date.now()}_${safeName}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    })
  if (uploadError) {
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 })
  }

  const { data: att, error } = await admin
    .from("work_item_attachments")
    .insert({
      work_item_id: id,
      org_id: caller.orgId,
      uploaded_by: caller.employeeId,
      kind: "file",
      file_name: file.name.slice(0, 200),
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
    })
    .select("*, uploader:fs_employees!work_item_attachments_uploaded_by_fkey(id, full_name)")
    .single()

  if (error) {
    // best-effort cleanup so we don't leave an orphaned object
    await admin.storage.from(BUCKET).remove([storagePath])
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ attachment: att }, { status: 201 })
}
