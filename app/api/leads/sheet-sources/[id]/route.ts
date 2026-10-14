import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/leads/sheet-sources/[id]
 * Get a single sheet source.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const admin = getSupabaseAdmin()

  const { data: source, error } = await admin
    .from("lead_source_sheets")
    .select("*")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (error || !source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 })
  }

  return NextResponse.json({ source })
}

/**
 * PATCH /api/leads/sheet-sources/[id]
 * Update a sheet source.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  // Only allow updating certain fields
  const allowedFields = [
    "label",
    "sheet_name",
    "header_row",
    "column_map",
    "is_active",
    "poll_interval_m",
  ]
  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) {
      updates[key] = body[key]
    }
  }

  const { data: source, error } = await admin
    .from("lead_source_sheets")
    .update(updates)
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ source })
}

/**
 * DELETE /api/leads/sheet-sources/[id]
 * Delete a sheet source and all its sync records.
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await context.params
  const admin = getSupabaseAdmin()

  const { error } = await admin
    .from("lead_source_sheets")
    .delete()
    .eq("id", id)
    .eq("org_id", caller.orgId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
