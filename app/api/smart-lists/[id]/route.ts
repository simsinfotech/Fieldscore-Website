import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/smart-lists/[id] — single smart list.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: list, error } = await admin
    .from("smart_lists")
    .select("*, creator:fs_employees!smart_lists_created_by_fkey(id, full_name)")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!list) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Visibility check: own list, shared, or admin
  if (!caller.isAdmin && list.created_by !== caller.employeeId && !list.is_shared) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  return NextResponse.json({ smartList: list })
}

/**
 * PUT /api/smart-lists/[id] — replace a smart list.
 * Only the creator or admin may update.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("smart_lists")
    .select("id, created_by")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!caller.isAdmin && existing.created_by !== caller.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.filters !== undefined) updates.filters = body.filters
  if (body.is_shared !== undefined) updates.is_shared = body.is_shared

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: list, error } = await admin
    .from("smart_lists")
    .update(updates)
    .eq("id", id)
    .select("*, creator:fs_employees!smart_lists_created_by_fkey(id, full_name)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ smartList: list })
}

/**
 * DELETE /api/smart-lists/[id] — delete a smart list.
 * Only the creator or admin may delete.
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
    .from("smart_lists")
    .select("id, created_by")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!caller.isAdmin && existing.created_by !== caller.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { error } = await admin.from("smart_lists").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
