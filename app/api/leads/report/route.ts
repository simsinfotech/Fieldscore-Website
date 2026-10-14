import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

interface LeadLite {
  assigned_to: string | null
  status: string
  source_label: string | null
}

type Bucket = {
  total: number
  reached: number      // contacted at least once (status !== 'new')
  interested: number   // qualified (+ legacy site_visit/negotiation)
  won: number
  lost: number
  notInterested: number // junk
}

function emptyBucket(): Bucket {
  return { total: 0, reached: 0, interested: 0, won: 0, lost: 0, notInterested: 0 }
}

function tally(b: Bucket, status: string) {
  b.total++
  if (status !== "new") b.reached++
  if (status === "qualified" || status === "site_visit" || status === "negotiation") b.interested++
  if (status === "won") b.won++
  if (status === "lost") b.lost++
  if (status === "junk") b.notInterested++
}

/**
 * GET /api/leads/report
 * Outcome aggregates for the caller's scope: setter=own, manager=subtree,
 * admin=all. Broken down per setter and per project (source_label).
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!caller.isAdmin && caller.department === "marketing") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()

  let query = admin
    .from("leads")
    .select("assigned_to, status, source_label")
    .eq("org_id", caller.orgId)

  if (caller.role === "setter") {
    query = query.eq("assigned_to", caller.employeeId)
  } else if (caller.role === "manager") {
    const { data: sub } = await admin.rpc("subtree_ids", { p_root: caller.employeeId })
    const ids = (sub ?? []).map((s: { id: string }) => s.id)
    query = query.in("assigned_to", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"])
  }

  const { data: leads } = await query
  const rows = (leads ?? []) as unknown as LeadLite[]

  // Employee names for the per-setter table
  const setterIds = [...new Set(rows.map((r) => r.assigned_to).filter(Boolean))] as string[]
  const nameById = new Map<string, string>()
  if (setterIds.length) {
    const { data: emps } = await admin
      .from("fs_employees")
      .select("id, full_name")
      .in("id", setterIds)
    for (const e of emps ?? []) nameById.set(e.id, e.full_name)
  }

  const overall = emptyBucket()
  const bySetter = new Map<string, Bucket>()
  const byProject = new Map<string, Bucket>()

  for (const r of rows) {
    tally(overall, r.status)
    if (r.assigned_to) {
      if (!bySetter.has(r.assigned_to)) bySetter.set(r.assigned_to, emptyBucket())
      tally(bySetter.get(r.assigned_to)!, r.status)
    }
    const proj = r.source_label || "— No project —"
    if (!byProject.has(proj)) byProject.set(proj, emptyBucket())
    tally(byProject.get(proj)!, r.status)
  }

  return NextResponse.json({
    scope: caller.isAdmin ? "org" : caller.role,
    overall,
    bySetter: [...bySetter.entries()]
      .map(([id, b]) => ({ id, name: nameById.get(id) || "Unknown", ...b }))
      .sort((a, b) => b.total - a.total),
    byProject: [...byProject.entries()]
      .map(([label, b]) => ({ label, ...b }))
      .sort((a, b) => b.total - a.total),
  })
}
