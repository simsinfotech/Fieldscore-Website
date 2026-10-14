import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit, diffFields } from "@/lib/audit/log"

const SELECT =
  "*, lead:leads!opportunities_lead_id_fkey(id, full_name, phone_e164, status)"

const WRITABLE_FIELDS = [
  "project", "value", "stage", "probability",
  "expected_close_date", "competitor", "lost_reason",
]

/**
 * GET /api/opportunities/[id] — single opportunity.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: opp, error } = await admin
    .from("opportunities")
    .select(SELECT)
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!opp) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ opportunity: opp })
}

/**
 * PATCH /api/opportunities/[id] — update an opportunity.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updates: Record<string, unknown> = {}
  for (const f of WRITABLE_FIELDS) {
    if (body[f] !== undefined) updates[f] = body[f]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 })
  }

  const { data: opp, error } = await admin
    .from("opportunities")
    .update(updates)
    .eq("id", id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const diff = diffFields(existing, { ...existing, ...updates }, WRITABLE_FIELDS)
  if (diff) {
    await logAudit({
      orgId: caller.orgId,
      actorId: caller.employeeId,
      entity: "opportunity",
      entityId: id,
      action: "update",
      before: diff.before,
      after: diff.after,
      source: "manual",
    })
  }

  return NextResponse.json({ opportunity: opp })
}
