import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/leads/assignment-rules
 * List all assignment rules for the caller's org (admin only).
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { data: rules, error } = await admin
    .from("assignment_rules")
    .select("*, pool_root:fs_employees!assignment_rules_pool_root_id_fkey(id, full_name)")
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch rules" }, { status: 500 })
  }

  return NextResponse.json({ rules: rules || [] })
}

/**
 * POST /api/leads/assignment-rules
 * Create a new assignment rule (admin only).
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { label, strategy, pool_root_id, source_filter } = body

  if (!label) {
    return NextResponse.json({ error: "label is required" }, { status: 400 })
  }

  const validStrategies = ["round_robin", "manual"]
  if (strategy && !validStrategies.includes(strategy)) {
    return NextResponse.json({ error: "Invalid strategy" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: rule, error } = await admin
    .from("assignment_rules")
    .insert({
      org_id: caller.orgId,
      label,
      strategy: strategy || "round_robin",
      pool_root_id: pool_root_id || null,
      source_filter: source_filter || [],
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rule }, { status: 201 })
}
