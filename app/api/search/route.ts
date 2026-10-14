import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

interface SearchResult {
  type: string
  id: string
  title: string
  subtitle: string | null
  url: string
}

/**
 * GET /api/search?q=<query>&type=<lead|contact|call|task>
 * Global search across leads, contacts, calls, tasks.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = request.nextUrl.searchParams.get("q")
  const typeFilter = request.nextUrl.searchParams.get("type")
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "20", 10)

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  const query = q.trim()
  const isPhone = /^[\d+]/.test(query)
  const results: SearchResult[] = []

  // Search leads
  if (!typeFilter || typeFilter === "lead") {
    let leadQuery = admin
      .from("leads")
      .select("id, full_name, phone_e164, status, city")
      .eq("org_id", caller.orgId)
      .limit(limit)

    if (isPhone) {
      leadQuery = leadQuery.ilike("phone_e164", `%${query}%`)
    } else {
      leadQuery = leadQuery.ilike("full_name", `%${query}%`)
    }

    const { data: leads } = await leadQuery

    for (const lead of leads || []) {
      results.push({
        type: "lead",
        id: lead.id,
        title: lead.full_name,
        subtitle: `${lead.phone_e164} · ${lead.status}${lead.city ? ` · ${lead.city}` : ""}`,
        url: `/leads/${lead.id}`,
      })
    }
  }

  // Search contacts
  if (!typeFilter || typeFilter === "contact") {
    let contactQuery = admin
      .from("contacts")
      .select("id, name, phone, email, relationship, lead_id")
      .eq("org_id", caller.orgId)
      .limit(limit)

    if (isPhone) {
      contactQuery = contactQuery.ilike("phone", `%${query}%`)
    } else {
      contactQuery = contactQuery.ilike("name", `%${query}%`)
    }

    const { data: contacts } = await contactQuery

    for (const contact of contacts || []) {
      results.push({
        type: "contact",
        id: contact.id,
        title: contact.name,
        subtitle: `${contact.phone || contact.email || ""}${contact.relationship ? ` · ${contact.relationship}` : ""}`,
        url: `/leads/${contact.lead_id}`,
      })
    }
  }

  // Search call transcripts
  if (!typeFilter || typeFilter === "call") {
    const { data: transcripts } = await admin
      .from("call_transcripts")
      .select("id, call_id, summary, raw_text, call:call_logs!call_transcripts_call_id_fkey(lead_id, client_number, call_started_at)")
      .ilike("raw_text", `%${query}%`)
      .limit(limit)

    for (const t of transcripts || []) {
      const call = t.call as { lead_id: string | null; client_number: string; call_started_at: string } | null
      results.push({
        type: "call",
        id: t.call_id,
        title: `Call transcript: ${call?.client_number || "Unknown"}`,
        subtitle: t.summary?.slice(0, 100) || t.raw_text.slice(0, 100),
        url: call?.lead_id ? `/leads/${call.lead_id}` : `/calls/${t.call_id}`,
      })
    }
  }

  // Search tasks
  if (!typeFilter || typeFilter === "task") {
    const { data: tasks } = await admin
      .from("work_items")
      .select("id, title, status, linked_lead_id")
      .eq("org_id", caller.orgId)
      .ilike("title", `%${query}%`)
      .limit(limit)

    for (const task of tasks || []) {
      results.push({
        type: "task",
        id: task.id,
        title: task.title,
        subtitle: `Status: ${task.status}`,
        url: task.linked_lead_id ? `/leads/${task.linked_lead_id}` : `/work`,
      })
    }
  }

  return NextResponse.json({
    results: results.slice(0, limit),
    total: results.length,
    query: q,
  })
}
