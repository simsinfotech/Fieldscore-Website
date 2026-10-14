import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/calls/queue?smart_list_id=<uuid>&skip=0&limit=10
 * Get next leads from a Smart List for auto-dialer.
 * Returns leads ordered by priority with call context.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const url = request.nextUrl
  const smartListId = url.searchParams.get("smart_list_id")
  const skip = parseInt(url.searchParams.get("skip") || "0", 10)
  const limit = parseInt(url.searchParams.get("limit") || "10", 10)

  if (!smartListId) {
    return NextResponse.json({ error: "smart_list_id is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Fetch the smart list
  const { data: smartList } = await admin
    .from("smart_lists")
    .select("id, filters, created_by, is_shared")
    .eq("id", smartListId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!smartList) {
    return NextResponse.json({ error: "Smart list not found" }, { status: 404 })
  }

  // Visibility check
  if (!caller.isAdmin && smartList.created_by !== caller.employeeId && !smartList.is_shared) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Build query from smart list filters
  const filters = smartList.filters as Record<string, unknown>

  let query = admin
    .from("leads")
    .select(
      "id, full_name, phone_e164, status, temperature, configuration, budget_max, city, " +
      "project, notes, assigned_to, updated_at"
    )
    .eq("org_id", caller.orgId)
    .not("status", "in", '("won","lost","junk")')
    .order("temperature", { ascending: true }) // hot first (alphabetical: cold < hot < warm)
    .order("updated_at", { ascending: true }) // least recently touched first
    .range(skip, skip + limit - 1)

  // Apply smart list filters dynamically
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    query = query.in("status", statuses)
  }
  if (filters.temperature) {
    const temps = Array.isArray(filters.temperature) ? filters.temperature : [filters.temperature]
    query = query.in("temperature", temps)
  }
  if (filters.source) {
    query = query.eq("source", filters.source as string)
  }
  if (filters.city) {
    query = query.eq("city", filters.city as string)
  }
  if (filters.assigned_to) {
    query = query.eq("assigned_to", filters.assigned_to as string)
  } else if (!caller.isAdmin) {
    // Non-admins only see their own leads in the queue
    query = query.eq("assigned_to", caller.employeeId)
  }
  if (filters.preferred_locations) {
    const locs = filters.preferred_locations as string[]
    query = query.overlaps("preferred_locations", locs)
  }
  if (filters.budget_min) {
    query = query.gte("budget_max", filters.budget_min as number)
  }
  if (filters.budget_max) {
    query = query.lte("budget_max", filters.budget_max as number)
  }
  if (filters.configuration) {
    query = query.eq("configuration", filters.configuration as string)
  }

  const { data: leads, error } = await query

  if (error) {
    console.error("call queue query error:", error)
    return NextResponse.json({ error: "Failed to fetch queue" }, { status: 500 })
  }

  // Enrich with last call info for each lead
  const leadIds = (leads || []).map((l) => l.id)
  let lastCalls: Record<string, { call_started_at: string; disposition: string | null }> = {}

  if (leadIds.length > 0) {
    const { data: calls } = await admin
      .from("call_logs")
      .select("lead_id, call_started_at, disposition")
      .in("lead_id", leadIds)
      .order("call_started_at", { ascending: false })

    if (calls) {
      for (const call of calls) {
        if (call.lead_id && !lastCalls[call.lead_id]) {
          lastCalls[call.lead_id] = {
            call_started_at: call.call_started_at,
            disposition: call.disposition,
          }
        }
      }
    }
  }

  const enrichedLeads = (leads || []).map((lead) => ({
    ...lead,
    last_call: lastCalls[lead.id] || null,
  }))

  return NextResponse.json({
    leads: enrichedLeads,
    total: enrichedLeads.length,
    skip,
    limit,
  })
}
