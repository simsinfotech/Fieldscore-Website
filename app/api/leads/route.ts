import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Marketing sees aggregate campaign performance, never individual lead PII.
  if (!caller.isAdmin && caller.department === "marketing") {
    return NextResponse.json({
      leads: [],
      restricted: "marketing",
      pagination: { page: 1, limit: 0, total: 0, totalPages: 0 },
    })
  }

  const admin = getSupabaseAdmin()
  const url = request.nextUrl
  const status = url.searchParams.get("status")
  const source = url.searchParams.get("source")
  const search = url.searchParams.get("search")
  const state = url.searchParams.get("state")          // assignment_state
  const label = url.searchParams.get("label")          // source_label
  const page = parseInt(url.searchParams.get("page") || "1", 10)
  const limit = parseInt(url.searchParams.get("limit") || "50", 10)
  const offset = (page - 1) * limit

  let query = admin
    .from("leads")
    .select("*, assigned_employee:fs_employees!leads_assigned_to_fkey(id, full_name, avatar_url)", {
      count: "exact",
    })
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  // Role-based filtering — only admin and sales_admin see all leads
  if (caller.role === "admin" || caller.role === "sales_admin" || caller.isAdmin) {
    // Admins see all leads in org (no additional filter)
  } else if (caller.role === "manager") {
    // Managers see leads assigned to their subtree AND leads awaiting
    // their approval (pending_manager_id = them, before distribution).
    const { data: subtree } = await admin.rpc("subtree_ids", {
      p_root: caller.employeeId,
    })
    const ids = (subtree ?? []).map((s: { id: string }) => s.id)
    if (ids.length > 0) {
      query = query.or(
        `assigned_to.in.(${ids.join(",")}),pending_manager_id.eq.${caller.employeeId}`
      )
    } else {
      query = query.eq("pending_manager_id", caller.employeeId)
    }
  } else {
    // Setters, viewers, and any other role see only their assigned leads
    query = query.eq("assigned_to", caller.employeeId)
  }

  if (status) {
    query = query.eq("status", status)
  }

  if (source) {
    query = query.eq("source", source)
  }

  if (state) {
    query = query.eq("assignment_state", state)
  }

  if (label) {
    query = query.eq("source_label", label)
  }

  if (search) {
    // Search by phone or name
    const isPhone = /^[\d+]/.test(search)
    if (isPhone) {
      query = query.ilike("phone_e164", `%${search}%`)
    } else {
      query = query.ilike("full_name", `%${search}%`)
    }
  }

  const { data: leads, count, error } = await query

  if (error) {
    console.error("Leads query error:", error)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }

  // Distinct sheet labels for the filter dropdown (admins/viewers/managers).
  const { data: labelRows } = await admin
    .from("leads")
    .select("source_label")
    .eq("org_id", caller.orgId)
    .not("source_label", "is", null)
  const labels = [...new Set((labelRows ?? []).map((r) => r.source_label).filter(Boolean))]

  // Total unassigned leads matching the current filters (for "assign all").
  let unassignedQ = admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("org_id", caller.orgId)
    .eq("assignment_state", "unassigned")
  if (source) unassignedQ = unassignedQ.eq("source", source)
  if (status) unassignedQ = unassignedQ.eq("status", status)
  if (label) unassignedQ = unassignedQ.eq("source_label", label)
  if (search) {
    const isPhone = /^[\d+]/.test(search)
    unassignedQ = isPhone
      ? unassignedQ.ilike("phone_e164", `%${search}%`)
      : unassignedQ.ilike("full_name", `%${search}%`)
  }
  const { count: unassignedCount } = await unassignedQ

  return NextResponse.json({
    leads: leads || [],
    labels,
    unassignedCount: unassignedCount || 0,
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  })
}
