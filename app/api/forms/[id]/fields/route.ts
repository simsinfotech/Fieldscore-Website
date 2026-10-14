import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/forms/[id]/fields
 * List fields for a form.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: formId } = await params
  const admin = getSupabaseAdmin()

  // Verify form belongs to org
  const { data: form } = await admin
    .from("custom_forms")
    .select("id")
    .eq("id", formId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

  const { data: fields } = await admin
    .from("form_fields")
    .select("*")
    .eq("form_id", formId)
    .order("sort_order", { ascending: true })

  return NextResponse.json({ fields: fields || [] })
}

/**
 * POST /api/forms/[id]/fields — add a field to a form. Admin only.
 * body: { label, field_key, field_type?, options?, is_required?, sort_order?, validation? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const { id: formId } = await params
  const body = await request.json()

  if (!body.label?.trim() || !body.field_key?.trim()) {
    return NextResponse.json(
      { error: "label and field_key are required" },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Verify form belongs to org
  const { data: form } = await admin
    .from("custom_forms")
    .select("id")
    .eq("id", formId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

  const { data: field, error } = await admin
    .from("form_fields")
    .insert({
      form_id: formId,
      label: body.label.trim(),
      field_key: body.field_key.trim(),
      field_type: body.field_type || "text",
      options: body.options || null,
      is_required: body.is_required ?? false,
      sort_order: body.sort_order ?? 0,
      validation: body.validation || null,
    })
    .select()
    .single()

  if (error) {
    console.error("form field create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ field }, { status: 201 })
}
