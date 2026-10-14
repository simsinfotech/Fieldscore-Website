import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"

const SELECT =
  "*, uploader:fs_employees!documents_uploaded_by_fkey(id, full_name, avatar_url)"

/**
 * GET /api/documents?lead_id=&category=&page=&limit=
 * List documents visible to the caller's org.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const url = request.nextUrl
  const leadId = url.searchParams.get("lead_id")
  const category = url.searchParams.get("category")
  const search = url.searchParams.get("search")
  const page = parseInt(url.searchParams.get("page") || "1", 10)
  const limit = parseInt(url.searchParams.get("limit") || "50", 10)
  const offset = (page - 1) * limit

  let query = admin
    .from("documents")
    .select(SELECT, { count: "exact" })
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (leadId) query = query.eq("lead_id", leadId)
  if (category) query = query.eq("category", category)
  if (search) query = query.ilike("title", `%${search}%`)

  const { data: documents, count, error } = await query

  if (error) {
    console.error("documents query error:", error)
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 })
  }

  return NextResponse.json({
    documents: documents || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}

/**
 * POST /api/documents — create a document record.
 * body: { title, category, lead_id?, storage_key, content_type?, size_bytes?, tags? }
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()

  if (!body.title?.trim() || !body.storage_key?.trim()) {
    return NextResponse.json(
      { error: "title and storage_key are required" },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  const { data: doc, error } = await admin
    .from("documents")
    .insert({
      org_id: caller.orgId,
      uploaded_by: caller.employeeId,
      lead_id: body.lead_id || null,
      category: body.category || "general",
      title: body.title.trim(),
      storage_key: body.storage_key.trim(),
      content_type: body.content_type || null,
      size_bytes: body.size_bytes || null,
      tags: body.tags || [],
    })
    .select(SELECT)
    .single()

  if (error) {
    console.error("document create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "document",
    entityId: doc.id,
    action: "create",
    after: { title: body.title, category: body.category || "general" },
    source: "manual",
  })

  return NextResponse.json({ document: doc }, { status: 201 })
}
