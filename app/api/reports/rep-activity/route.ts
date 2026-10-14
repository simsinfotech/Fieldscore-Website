import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/reports/rep-activity?from=YYYY-MM-DD&to=YYYY-MM-DD&employee_id=<uuid>
 * Per-employee activity: calls, tasks, lead activities.
 * Admin/manager only (managers see their subtree).
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "manager" && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = request.nextUrl
  const from = url.searchParams.get("from") || new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0]
  const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0]
  const employeeId = url.searchParams.get("employee_id")

  const admin = getSupabaseAdmin()

  // Determine visible employee IDs
  let employeeIds: string[] = []

  if (employeeId) {
    employeeIds = [employeeId]
  } else if (caller.isAdmin || caller.role === "sales_admin") {
    const { data: emps } = await admin
      .from("fs_employees")
      .select("id")
      .eq("org_id", caller.orgId)
      .eq("is_active", true)
    employeeIds = (emps || []).map((e) => e.id)
  } else if (caller.role === "manager") {
    const { data: subtree } = await admin.rpc("subtree_ids", { p_root: caller.employeeId })
    employeeIds = (subtree || []).map((s: { id: string }) => s.id)
  }

  if (employeeIds.length === 0) {
    return NextResponse.json({ report: [] })
  }

  // Fetch call daily aggregates
  const { data: callDaily } = await admin
    .from("call_daily")
    .select("employee_id, date, total_calls, connected_calls, total_duration_seconds, unique_numbers")
    .in("employee_id", employeeIds)
    .gte("date", from)
    .lte("date", to)

  // Fetch task counts
  const { data: tasks } = await admin
    .from("work_items")
    .select("assigned_to, status")
    .in("assigned_to", employeeIds)
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)

  // Fetch lead activities
  const { data: activities } = await admin
    .from("lead_activities")
    .select("actor_id, type")
    .in("actor_id", employeeIds)
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)

  // Fetch employee names
  const { data: employees } = await admin
    .from("fs_employees")
    .select("id, full_name")
    .in("id", employeeIds)

  const nameMap = new Map((employees || []).map((e) => [e.id, e.full_name]))

  // Aggregate per employee
  const report = employeeIds.map((empId) => {
    const empCalls = (callDaily || []).filter((c) => c.employee_id === empId)
    const empTasks = (tasks || []).filter((t) => t.assigned_to === empId)
    const empActivities = (activities || []).filter((a) => a.actor_id === empId)

    return {
      employee_id: empId,
      employee_name: nameMap.get(empId) || "Unknown",
      calls: {
        total: empCalls.reduce((s, c) => s + c.total_calls, 0),
        connected: empCalls.reduce((s, c) => s + c.connected_calls, 0),
        total_duration_seconds: empCalls.reduce((s, c) => s + c.total_duration_seconds, 0),
        unique_numbers: empCalls.reduce((s, c) => s + c.unique_numbers, 0),
      },
      tasks: {
        total: empTasks.length,
        completed: empTasks.filter((t) => t.status === "done").length,
        pending: empTasks.filter((t) => t.status === "todo" || t.status === "in_progress").length,
      },
      activities: {
        total: empActivities.length,
        by_type: empActivities.reduce((acc, a) => {
          acc[a.type] = (acc[a.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
      },
    }
  })

  return NextResponse.json({ report, from, to })
}
