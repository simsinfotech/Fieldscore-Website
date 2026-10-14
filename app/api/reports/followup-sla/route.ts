import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/reports/followup-sla?from=&to=
 * Follow-up SLA compliance: work_items with linked_lead_id vs due_at.
 * Admin/manager/sales_admin only.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin && caller.role !== "manager" && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = request.nextUrl
  const from = url.searchParams.get("from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0]
  const to = url.searchParams.get("to") || new Date().toISOString().split("T")[0]

  const admin = getSupabaseAdmin()

  const { data: tasks, error } = await admin
    .from("work_items")
    .select("id, assigned_to, status, due_at, created_at, linked_lead_id, " +
            "assignee:fs_employees!work_items_assigned_to_fkey(id, full_name)")
    .eq("org_id", caller.orgId)
    .not("linked_lead_id", "is", null)
    .not("due_at", "is", null)
    .gte("created_at", `${from}T00:00:00`)
    .lte("created_at", `${to}T23:59:59`)

  if (error) {
    console.error("followup SLA query error:", error)
    return NextResponse.json({ error: "Failed to fetch SLA data" }, { status: 500 })
  }

  const now = new Date()
  let onTime = 0
  let overdue = 0
  let pending = 0
  const overdueByEmployee: Record<string, { name: string; count: number }> = {}

  for (const task of tasks || []) {
    const dueAt = new Date(task.due_at)

    if (task.status === "done") {
      onTime++
    } else if (dueAt < now) {
      overdue++
      const empId = task.assigned_to || "unassigned"
      const empName = (task.assignee as { full_name: string } | null)?.full_name || "Unassigned"
      if (!overdueByEmployee[empId]) overdueByEmployee[empId] = { name: empName, count: 0 }
      overdueByEmployee[empId].count++
    } else {
      pending++
    }
  }

  const total = (tasks || []).length
  const complianceRate = total > 0 ? Math.round((onTime / total) * 100) : 100

  return NextResponse.json({
    total_followups: total,
    on_time: onTime,
    overdue,
    pending,
    compliance_rate_pct: complianceRate,
    overdue_by_employee: Object.entries(overdueByEmployee)
      .map(([id, data]) => ({ employee_id: id, ...data }))
      .sort((a, b) => b.count - a.count),
    from,
    to,
  })
}
