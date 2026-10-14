import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/smart-lists
 * List smart lists visible to the caller (own + shared + admin sees all).
 */
export async function GET(_request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()

  let query = admin
    .from("smart_lists")
    .select("*, creator:fs_employees!smart_lists_created_by_fkey(id, full_name)")
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })

  if (!caller.isAdmin) {
    query = query.or(`created_by.eq.${caller.employeeId},is_shared.eq.true`)
  }

  const { data: lists, error } = await query

  if (error) {
    console.error("smart-lists query error:", error)
    return NextResponse.json({ error: "Failed to fetch smart lists" }, { status: 500 })
  }

  return NextResponse.json({ smartLists: lists || [] })
}

/**
 * POST /api/smart-lists — create a saved filter view.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
  }
  if (!body.filters || typeof body.filters !== "object") {
    return NextResponse.json({ error: "filters object is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: list, error } = await admin
    .from("smart_lists")
    .insert({
      org_id: caller.orgId,
      created_by: caller.employeeId,
      name: body.name.trim(),
      filters: body.filters,
      is_shared: body.is_shared ?? false,
    })
    .select("*, creator:fs_employees!smart_lists_created_by_fkey(id, full_name)")
    .single()

  if (error) {
    console.error("smart-list create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ smartList: list }, { status: 201 })
}
