import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"

const SELECT =
  "*, lead:leads!opportunities_lead_id_fkey(id, full_name, phone_e164, status)"

/**
 * GET /api/opportunities?lead_id=<uuid>&stage=<stage>
 * List opportunities. Filtered by lead_id or stage. Scoped to org.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const url = request.nextUrl
  const leadId = url.searchParams.get("lead_id")
  const stage = url.searchParams.get("stage")

  let query = admin
    .from("opportunities")
    .select(SELECT)
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })

  if (leadId) query = query.eq("lead_id", leadId)
  if (stage) query = query.eq("stage", stage)

  // Non-admin roles: filter to leads they can see
  if (!caller.isAdmin && caller.role !== "sales_admin") {
    if (caller.role === "manager") {
      const { data: subtree } = await admin.rpc("subtree_ids", {
        p_root: caller.employeeId,
      })
      const ids = (subtree ?? []).map((s: { id: string }) => s.id)
      if (ids.length > 0) {
        query = query.in(
          "lead_id",
          admin
            .from("leads")
            .select("id")
            .eq("org_id", caller.orgId)
            .or(`assigned_to.in.(${ids.join(",")})`)
        )
      }
    } else {
      // Setters/viewers: only their assigned leads
      query = query.in(
        "lead_id",
        admin
          .from("leads")
          .select("id")
          .eq("assigned_to", caller.employeeId)
      )
    }
  }

  const { data: opportunities, error } = await query

  if (error) {
    console.error("opportunities query error:", error)
    return NextResponse.json({ error: "Failed to fetch opportunities" }, { status: 500 })
  }

  return NextResponse.json({ opportunities: opportunities || [] })
}

/**
 * POST /api/opportunities — create an opportunity for a lead.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()

  if (!body.lead_id) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify lead belongs to caller's org
  const { data: lead } = await admin
    .from("leads")
    .select("id")
    .eq("id", body.lead_id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const { data: opp, error } = await admin
    .from("opportunities")
    .insert({
      org_id: caller.orgId,
      lead_id: body.lead_id,
      project: body.project || null,
      value: body.value ?? null,
      stage: body.stage || "new",
      probability: body.probability ?? 0,
      expected_close_date: body.expected_close_date || null,
      competitor: body.competitor || null,
      lost_reason: body.lost_reason || null,
    })
    .select(SELECT)
    .single()

  if (error) {
    console.error("opportunity create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "opportunity",
    entityId: opp.id,
    action: "create",
    after: opp,
    source: "manual",
  })

  return NextResponse.json({ opportunity: opp }, { status: 201 })
}
