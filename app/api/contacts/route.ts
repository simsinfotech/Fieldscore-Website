import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"

/**
 * GET /api/contacts?lead_id=<uuid>
 * List contacts for a lead. Requires lead visibility.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const leadId = request.nextUrl.searchParams.get("lead_id")

  if (!leadId) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
  }

  // Verify lead belongs to caller's org
  const { data: lead } = await admin
    .from("leads")
    .select("id")
    .eq("id", leadId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const { data: contacts, error } = await admin
    .from("contacts")
    .select("*")
    .eq("lead_id", leadId)
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("contacts query error:", error)
    return NextResponse.json({ error: "Failed to fetch contacts" }, { status: 500 })
  }

  return NextResponse.json({ contacts: contacts || [] })
}

/**
 * POST /api/contacts — create a contact for a lead.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()

  if (!body.lead_id) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
  }
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 })
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

  const { data: contact, error } = await admin
    .from("contacts")
    .insert({
      org_id: caller.orgId,
      lead_id: body.lead_id,
      name: body.name.trim(),
      phone: body.phone || null,
      email: body.email || null,
      relationship: body.relationship || null,
      decision_role: body.decision_role || null,
      tags: body.tags || [],
    })
    .select("*")
    .single()

  if (error) {
    console.error("contact create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "contact",
    entityId: contact.id,
    action: "create",
    after: contact,
    source: "manual",
  })

  return NextResponse.json({ contact }, { status: 201 })
}
