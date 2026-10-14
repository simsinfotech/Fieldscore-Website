import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/reports/call-intelligence?from=&to=
 * AI analyses aggregated: intent distribution, objection types, coaching scores.
 * Admin/manager/sales_admin only.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "manager" && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = request.nextUrl
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0]

  const admin = getSupabaseAdmin()

  const { data: analyses, error } = await admin
    .from("ai_analyses")
    .select("signals, coaching, confidence, processed_at")
    .eq("org_id", caller.orgId)
    .gte("processed_at", `${from}T00:00:00`)
    .lte("processed_at", `${to}T23:59:59`)

  if (error) {
    console.error("call intelligence query error:", error)
    return NextResponse.json({ error: "Failed to fetch intelligence data" }, { status: 500 })
  }

  // Aggregate intent distribution
  const intentCounts: Record<string, number> = {}
  const objectionCounts: Record<string, number> = {}
  const coachingTotals: Record<string, { sum: number; count: number }> = {}
  let totalAnalyses = 0
  let avgConfidence = 0

  for (const analysis of analyses || []) {
    totalAnalyses++
    avgConfidence += Number(analysis.confidence || 0)

    // Intent signals
    const signals = analysis.signals as Record<string, unknown> | null
    if (signals?.intent) {
      const intent = String(signals.intent)
      intentCounts[intent] = (intentCounts[intent] || 0) + 1
    }

    // Objections
    const objections = (signals?.objections || []) as string[]
    for (const obj of objections) {
      objectionCounts[obj] = (objectionCounts[obj] || 0) + 1
    }

    // Coaching dimensions
    const coaching = analysis.coaching as Record<string, number> | null
    if (coaching) {
      for (const [dim, score] of Object.entries(coaching)) {
        if (typeof score === "number") {
          if (!coachingTotals[dim]) coachingTotals[dim] = { sum: 0, count: 0 }
          coachingTotals[dim].sum += score
          coachingTotals[dim].count++
        }
      }
    }
  }

  const coachingAverages: Record<string, number> = {}
  for (const [dim, totals] of Object.entries(coachingTotals)) {
    coachingAverages[dim] = Math.round((totals.sum / totals.count) * 10) / 10
  }

  return NextResponse.json({
    total_analyses: totalAnalyses,
    avg_confidence: totalAnalyses > 0 ? Math.round((avgConfidence / totalAnalyses) * 100) / 100 : 0,
    intent_distribution: intentCounts,
    top_objections: Object.entries(objectionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([objection, count]) => ({ objection, count })),
    coaching_averages: coachingAverages,
    from,
    to,
  })
}
