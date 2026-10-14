import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/reports/pipeline
 * SUM opportunities.value GROUP BY stage — pipeline revenue data.
 * Admin/manager/sales_admin only.
 */
export async function GET(_request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "manager" && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()

  const { data: opportunities, error } = await admin
    .from("opportunities")
    .select("stage, value, probability")
    .eq("org_id", caller.orgId)

  if (error) {
    console.error("pipeline query error:", error)
    return NextResponse.json({ error: "Failed to fetch pipeline data" }, { status: 500 })
  }

  // Aggregate by stage
  const stageMap = new Map<string, { count: number; total_value: number; weighted_value: number }>()

  for (const opp of opportunities || []) {
    const stage = opp.stage || "unknown"
    const existing = stageMap.get(stage) || { count: 0, total_value: 0, weighted_value: 0 }
    existing.count++
    existing.total_value += Number(opp.value || 0)
    existing.weighted_value += Number(opp.value || 0) * ((opp.probability || 0) / 100)
    stageMap.set(stage, existing)
  }

  const pipeline = Array.from(stageMap.entries()).map(([stage, data]) => ({
    stage,
    ...data,
  }))

  const totals = {
    total_deals: opportunities?.length || 0,
    total_value: pipeline.reduce((s, p) => s + p.total_value, 0),
    weighted_value: pipeline.reduce((s, p) => s + p.weighted_value, 0),
  }

  return NextResponse.json({ pipeline, totals })
}
