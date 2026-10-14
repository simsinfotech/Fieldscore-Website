import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/forms/[id]
 * Single form with all its fields.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: form } = await admin
    .from("custom_forms")
    .select("*, fields:form_fields(*)")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!form) return NextResponse.json({ error: "Form not found" }, { status: 404 })

  // Sort fields by sort_order
  if (form.fields) {
    (form.fields as { sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order)
  }

  return NextResponse.json({ form })
}

/**
 * PATCH /api/forms/[id]
 * Update form metadata. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("custom_forms")
    .select("id")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Form not found" }, { status: 404 })

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.description !== undefined) updates.description = body.description
  if (body.context !== undefined) updates.context = body.context
  if (body.is_active !== undefined) updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: form, error } = await admin
    .from("custom_forms")
    .update(updates)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ form })
}
