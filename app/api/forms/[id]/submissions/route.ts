import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/forms/[id]/submissions?lead_id=
 * List submissions for a form. Admin/manager see all; others see own.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: formId } = await params
  const leadId = request.nextUrl.searchParams.get("lead_id")
  const admin = getSupabaseAdmin()

  // Verify form belongs to org
  const { data: form } = await admin
    .from("custom_forms")
    .select("id")
    .eq("id", formId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

  let query = admin
    .from("form_submissions")
    .select("*, submitter:fs_employees!form_submissions_submitted_by_fkey(id, full_name)")
    .eq("form_id", formId)
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })

  if (leadId) query = query.eq("lead_id", leadId)

  // Non-admins/managers only see their own submissions
  if (!caller.isAdmin && caller.role !== "manager" && caller.role !== "sales_admin") {
    query = query.eq("submitted_by", caller.employeeId)
  }

  const { data: submissions, error } = await query

  if (error) {
    console.error("form submissions query error:", error)
    return NextResponse.json({ error: "Failed to fetch submissions" }, { status: 500 })
  }

  return NextResponse.json({ submissions: submissions || [] })
}

/**
 * POST /api/forms/[id]/submissions — submit a form.
 * body: { data: { field_key: value, ... }, lead_id? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: formId } = await params
  const body = await request.json()

  if (!body.data || typeof body.data !== "object") {
    return NextResponse.json({ error: "data object is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify form belongs to org and is active
  const { data: form } = await admin
    .from("custom_forms")
    .select("id, is_active")
    .eq("id", formId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })
  if (!form.is_active) {
    return NextResponse.json({ error: "Form is not active" }, { status: 400 })
  }

  // Validate required fields
  const { data: fields } = await admin
    .from("form_fields")
    .select("field_key, is_required, label")
    .eq("form_id", formId)

  const missing = (fields || [])
    .filter((f) => f.is_required && !body.data[f.field_key])
    .map((f) => f.label)

  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 }
    )
  }

  const { data: submission, error } = await admin
    .from("form_submissions")
    .insert({
      form_id: formId,
      org_id: caller.orgId,
      submitted_by: caller.employeeId,
      lead_id: body.lead_id || null,
      data: body.data,
    })
    .select()
    .single()

  if (error) {
    console.error("form submission error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ submission }, { status: 201 })
}
