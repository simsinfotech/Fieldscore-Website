import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/forms?context=lead|visit|call|general
 * List custom forms for the org.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const context = request.nextUrl.searchParams.get("context")

  let query = admin
    .from("custom_forms")
    .select("*, creator:fs_employees!custom_forms_created_by_fkey(id, full_name), fields:form_fields(count)")
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })

  if (context) query = query.eq("context", context)

  const { data: forms, error } = await query

  if (error) {
    console.error("forms query error:", error)
    return NextResponse.json({ error: "Failed to fetch forms" }, { status: 500 })
  }

  return NextResponse.json({ forms: forms || [] })
}

/**
 * POST /api/forms — create a custom form. Admin only.
 * body: { name, description?, context? }
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  const body = await request.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: form, error } = await admin
    .from("custom_forms")
    .insert({
      org_id: caller.orgId,
      name: body.name.trim(),
      description: body.description || null,
      context: body.context || "general",
      is_active: body.is_active ?? true,
      created_by: caller.employeeId,
    })
    .select()
    .single()

  if (error) {
    console.error("form create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ form }, { status: 201 })
}
