import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"

const SELECT =
  "*, employee:fs_employees!calendar_events_employee_id_fkey(id, full_name, avatar_url), " +
  "lead:leads!calendar_events_lead_id_fkey(id, full_name, phone_e164)"

/**
 * GET /api/calendar?start=&end=&employee_id=&event_type=&lead_id=
 * List calendar events. Managers see their subtree; others see own.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const url = request.nextUrl
  const start = url.searchParams.get("start")
  const end = url.searchParams.get("end")
  const employeeId = url.searchParams.get("employee_id")
  const eventType = url.searchParams.get("event_type")
  const leadId = url.searchParams.get("lead_id")
  const status = url.searchParams.get("status")

  let query = admin
    .from("calendar_events")
    .select(SELECT)
    .eq("org_id", caller.orgId)
    .order("start_at", { ascending: true })

  // Date range filter
  if (start) query = query.gte("start_at", start)
  if (end) query = query.lte("start_at", end)

  // Event type filter
  if (eventType) query = query.eq("event_type", eventType)
  if (leadId) query = query.eq("lead_id", leadId)
  if (status) query = query.eq("status", status)

  // Scope: admin/sales_admin/manager see requested employee or all
  if (caller.isAdmin || caller.role === "admin" || caller.role === "sales_admin") {
    if (employeeId) query = query.eq("employee_id", employeeId)
  } else if (caller.role === "manager") {
    const { data: subtree } = await admin.rpc("subtree_ids", { p_root: caller.employeeId })
    const ids = (subtree ?? []).map((s: { id: string }) => s.id)
    if (employeeId && ids.includes(employeeId)) {
      query = query.eq("employee_id", employeeId)
    } else {
      query = query.in("employee_id", ids)
    }
  } else {
    query = query.eq("employee_id", caller.employeeId)
  }

  const { data: events, error } = await query

  if (error) {
    console.error("calendar query error:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }

  return NextResponse.json({ events: events || [] })
}

/**
 * POST /api/calendar — create a calendar event.
 * body: { title, event_type, start_at, end_at?, lead_id?, location?,
 *         description?, is_all_day?, employee_id? }
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()

  if (!body.title?.trim() || !body.start_at) {
    return NextResponse.json(
      { error: "title and start_at are required" },
      { status: 400 }
    )
  }

  // Only admins/managers can create events for others
  const targetEmployee = body.employee_id || caller.employeeId
  if (targetEmployee !== caller.employeeId && !caller.isAdmin && caller.role !== "manager") {
    return NextResponse.json(
      { error: "Only admins and managers can create events for others" },
      { status: 403 }
    )
  }

  const admin = getSupabaseAdmin()

  const { data: event, error } = await admin
    .from("calendar_events")
    .insert({
      org_id: caller.orgId,
      employee_id: targetEmployee,
      lead_id: body.lead_id || null,
      title: body.title.trim(),
      description: body.description || null,
      event_type: body.event_type || "meeting",
      start_at: body.start_at,
      end_at: body.end_at || null,
      location: body.location || null,
      is_all_day: body.is_all_day ?? false,
      status: "scheduled",
    })
    .select(SELECT)
    .single()

  if (error) {
    console.error("calendar create error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Notify the employee if created by someone else
  if (targetEmployee !== caller.employeeId) {
    await admin.from("fs_notifications").insert({
      recipient_id: targetEmployee,
      type: "calendar_event",
      title: "New event scheduled",
      message: `${body.event_type || "Meeting"}: "${body.title}" scheduled for you`,
    })
  }

  // Log activity on lead timeline if linked
  if (body.lead_id) {
    await admin.from("lead_activities").insert({
      lead_id: body.lead_id,
      actor_id: caller.employeeId,
      type: "visit",
      body: `${body.event_type || "Meeting"} scheduled: ${body.title}`,
    })
  }

  await logAudit({
    orgId: caller.orgId,
    actorId: caller.employeeId,
    entity: "calendar_event",
    entityId: event?.id ?? "",
    action: "create",
    after: { title: body.title, event_type: body.event_type, start_at: body.start_at },
    source: "manual",
  })

  return NextResponse.json({ event }, { status: 201 })
}
