import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

interface TimelineEntry {
  id: string
  type: string // call, whatsapp, sms, note, status_change, visit, ai_update, task
  channel?: string
  title: string
  body: string | null
  actor_name: string | null
  created_at: string
  metadata?: Record<string, unknown>
}

/**
 * GET /api/leads/[id]/timeline?limit=50&offset=0&type=
 * Unified customer timeline: calls + WhatsApp + SMS + notes + visits + tasks + stage changes.
 * All interactions in one chronological view.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: leadId } = await params
  const url = request.nextUrl
  const limit = parseInt(url.searchParams.get("limit") || "50", 10)
  const offset = parseInt(url.searchParams.get("offset") || "0", 10)
  const typeFilter = url.searchParams.get("type")

  const admin = getSupabaseAdmin()

  // Verify lead belongs to caller's org
  const { data: lead } = await admin
    .from("leads")
    .select("id, full_name")
    .eq("id", leadId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const timeline: TimelineEntry[] = []

  // 1. Lead activities (notes, status changes, AI updates)
  if (!typeFilter || ["note", "status_change", "ai_update", "visit"].includes(typeFilter)) {
    let activityQuery = admin
      .from("lead_activities")
      .select("id, type, body, created_at, actor:fs_employees!lead_activities_actor_id_fkey(full_name)")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })

    if (typeFilter) activityQuery = activityQuery.eq("type", typeFilter)

    const { data: activities } = await activityQuery
    for (const a of activities || []) {
      timeline.push({
        id: a.id,
        type: a.type,
        title: formatActivityTitle(a.type),
        body: a.body,
        actor_name: (a.actor as { full_name: string } | null)?.full_name || null,
        created_at: a.created_at,
      })
    }
  }

  // 2. Calls
  if (!typeFilter || typeFilter === "call") {
    const { data: calls } = await admin
      .from("call_logs")
      .select(
        "id, direction, duration_seconds, disposition, call_started_at, recording_status, " +
        "employee:fs_employees!call_logs_employee_id_fkey(full_name), " +
        "transcript:call_transcripts!call_transcripts_call_id_fkey(summary)"
      )
      .eq("lead_id", leadId)
      .order("call_started_at", { ascending: false })

    for (const c of calls || []) {
      const transcriptArr = c.transcript as { summary: string | null }[] | null
      const summary = transcriptArr?.[0]?.summary || null
      timeline.push({
        id: c.id,
        type: "call",
        channel: "phone",
        title: `${c.direction} call (${formatDuration(c.duration_seconds)})`,
        body: summary || (c.disposition ? `Disposition: ${c.disposition}` : null),
        actor_name: (c.employee as { full_name: string } | null)?.full_name || null,
        created_at: c.call_started_at,
        metadata: {
          direction: c.direction,
          duration_seconds: c.duration_seconds,
          disposition: c.disposition,
          recording_status: c.recording_status,
        },
      })
    }
  }

  // 3. Messages (WhatsApp, SMS)
  if (!typeFilter || typeFilter === "whatsapp" || typeFilter === "sms") {
    let msgQuery = admin
      .from("messages")
      .select("id, channel, direction, body, status, created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })

    if (typeFilter === "whatsapp") msgQuery = msgQuery.eq("channel", "whatsapp")
    if (typeFilter === "sms") msgQuery = msgQuery.eq("channel", "sms")

    const { data: messages } = await msgQuery
    for (const m of messages || []) {
      timeline.push({
        id: m.id,
        type: m.channel,
        channel: m.channel,
        title: `${m.direction} ${m.channel}`,
        body: m.body,
        actor_name: null,
        created_at: m.created_at,
        metadata: { direction: m.direction, status: m.status },
      })
    }
  }

  // 4. Tasks linked to this lead
  if (!typeFilter || typeFilter === "task") {
    const { data: tasks } = await admin
      .from("work_items")
      .select("id, title, status, due_at, created_at, assignee:fs_employees!work_items_assigned_to_fkey(full_name)")
      .eq("linked_lead_id", leadId)
      .order("created_at", { ascending: false })

    for (const t of tasks || []) {
      timeline.push({
        id: t.id,
        type: "task",
        title: `Task: ${t.title}`,
        body: `Status: ${t.status}${t.due_at ? ` | Due: ${t.due_at}` : ""}`,
        actor_name: (t.assignee as { full_name: string } | null)?.full_name || null,
        created_at: t.created_at,
        metadata: { status: t.status, due_at: t.due_at },
      })
    }
  }

  // Sort all entries by created_at descending and paginate
  timeline.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const paginated = timeline.slice(offset, offset + limit)

  return NextResponse.json({
    timeline: paginated,
    total: timeline.length,
    limit,
    offset,
  })
}

function formatActivityTitle(type: string): string {
  switch (type) {
    case "note": return "Note added"
    case "status_change": return "Status changed"
    case "ai_update": return "AI suggestion"
    case "visit": return "Site visit"
    case "whatsapp": return "WhatsApp message"
    case "sms": return "SMS"
    case "call": return "Call"
    default: return type
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}
