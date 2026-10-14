import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"

const SELECT =
  "*, uploader:fs_employees!documents_uploaded_by_fkey(id, full_name, avatar_url)"

/**
 * GET /api/documents/[id]
 * Single document with share & view stats.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: doc } = await admin
    .from("documents")
    .select(SELECT)
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })

  // Fetch shares with view counts
  const { data: shares } = await admin
    .from("document_shares")
    .select("*, views:document_views(count)")
    .eq("document_id", id)

  return NextResponse.json({ document: doc, shares: shares || [] })
}

/**
 * PATCH /api/documents/[id]
 * Update title, category, tags. Only uploader or admin.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("documents")
    .select("id, uploaded_by")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  if (existing.uploaded_by !== caller.employeeId && !caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (body.title !== undefined) updates.title = body.title.trim()
  if (body.category !== undefined) updates.category = body.category
  if (body.tags !== undefined) updates.tags = body.tags
  if (body.lead_id !== undefined) updates.lead_id = body.lead_id || null

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: doc, error } = await admin
    .from("documents")
    .update(updates)
    .eq("id", id)
    .select(SELECT)
    .single()

  if (error) {
    console.error("document update error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ document: doc })
}

/**
 * DELETE /api/documents/[id]
 * Only uploader or admin.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("documents")
    .select("id, uploaded_by, title, storage_key")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 })
  if (existing.uploaded_by !== caller.employeeId && !caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await admin.from("documents").delete().eq("id", id)

  if (error) {
    console.error("document delete error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "document",
    entityId: id,
    action: "delete",
    before: { title: existing.title },
    source: "manual",
  })

  return NextResponse.json({ success: true })
}
