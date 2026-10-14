import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { syncSheet } from "@/lib/leads/sheet-sync"
import type { LeadSourceSheet } from "@/types"

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/leads/sheet-sources/[id]/sync
 * Manual sync trigger (admin only).
 */
export async function POST(_request: NextRequest, context: RouteContext) {
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

  const result = await syncSheet(admin, source as LeadSourceSheet)

  return NextResponse.json({ success: true, ...result })
}
