import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit, diffFields } from "@/lib/audit/log"

const WRITABLE_FIELDS = [
  "name", "phone", "email", "relationship", "decision_role", "tags",
]

/**
 * GET /api/contacts/[id] — single contact.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: contact, error } = await admin
    .from("contacts")
    .select("*")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ contact })
}

/**
 * PATCH /api/contacts/[id] — update a contact.
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
    .from("contacts")
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

  const { data: contact, error } = await admin
    .from("contacts")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const diff = diffFields(existing, contact, WRITABLE_FIELDS)
  if (diff) {
    await logAudit({
      orgId: caller.orgId,
      actorId: caller.employeeId,
      entity: "contact",
      entityId: id,
      action: "update",
      before: diff.before,
      after: diff.after,
      source: "manual",
    })
  }

  return NextResponse.json({ contact })
}

/**
 * DELETE /api/contacts/[id] — delete a contact.
 * Admin or sales_admin only.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const admin = getSupabaseAdmin()

  const { data: existing } = await admin
    .from("contacts")
    .select("id, name, lead_id")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { error } = await admin.from("contacts").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "contact",
    entityId: id,
    action: "delete",
    before: existing,
    source: "manual",
  })

  return NextResponse.json({ success: true })
}
