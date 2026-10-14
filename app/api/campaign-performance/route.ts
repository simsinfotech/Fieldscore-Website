import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/campaign-performance?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Aggregate, PII-free lead metrics per source for the caller's org.
 * Safe for marketing — returns counts and connect rate, never contacts.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const from = request.nextUrl.searchParams.get("from")
  const to = request.nextUrl.searchParams.get("to")

  let query = admin
    .from("campaign_performance")
    .select("*")
    .eq("org_id", caller.orgId)
    .order("day", { ascending: false })

  if (from) query = query.gte("day", from)
  if (to) query = query.lte("day", to)

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: "Failed to fetch campaign performance" }, { status: 500 })
  }

  // Roll up per source for a headline summary.
  const bySource = new Map<string, { leads: number; contacted: number; won: number }>()
  for (const r of data ?? []) {
    const s = bySource.get(r.source) ?? { leads: 0, contacted: 0, won: 0 }
    s.leads += r.leads
    s.contacted += r.contacted
    s.won += r.won
    bySource.set(r.source, s)
  }
  const summary = [...bySource.entries()].map(([source, s]) => ({
    source,
    ...s,
    connectRate: s.leads ? Math.round((s.contacted / s.leads) * 100) : 0,
    winRate: s.leads ? Math.round((s.won / s.leads) * 100) : 0,
  }))

  return NextResponse.json({ rows: data ?? [], summary })
}
