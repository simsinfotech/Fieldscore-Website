import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

const BUCKET = "work-attachments"
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB per inline image
const ALLOWED = ["image/png", "image/jpeg", "image/gif", "image/webp"]

type Caller = NonNullable<Awaited<ReturnType<typeof resolveEmployee>>>

/** Members of the task (creator/assignee/watcher/admin/scope) may view/edit. */
async function loadMemberItem(
  caller: Caller, id: string, admin: ReturnType<typeof getSupabaseAdmin>
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

/**
 * GET /api/work-items/[id]/images?p=<storagePath>
 * Redirects to a fresh short-lived signed URL for an inline canvas image.
 * The returned URL is used as the <img src> in the document, so it must stay
 * valid over time — hence a per-request signed URL rather than a baked-in one.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const path = request.nextUrl.searchParams.get("p") || ""
  const admin = getSupabaseAdmin()

  // Path must belong to this task's folder.
  if (!path.startsWith(`${caller.orgId}/${id}/`)) {
    return NextResponse.json({ error: "Bad path" }, { status: 400 })
  }
  const { canView } = await loadMemberItem(caller, id, admin)
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 120)
  if (error || !signed) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.redirect(signed.signedUrl)
}

/**
 * POST /api/work-items/[id]/images — upload a pasted/dropped image and return
 * a stable proxy `src` for the editor. Not listed under Files & links.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()
  const { item, canView } = await loadMemberItem(caller, id, admin)
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPG, GIF or WebP images" }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "Image too large (max 10 MB)" }, { status: 400 })
  }

  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg")
  const storagePath = `${caller.orgId}/${id}/inline/${Date.now()}_${Math.round(file.size)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })
  if (uploadError) {
    return NextResponse.json({ error: "Upload failed: " + uploadError.message }, { status: 500 })
  }

  const src = `/api/work-items/${id}/images?p=${encodeURIComponent(storagePath)}`
  return NextResponse.json({ src }, { status: 201 })
}
