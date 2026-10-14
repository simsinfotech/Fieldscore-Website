import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/my-work — the single "what's on my plate" feed:
 *  - open work assigned to me (with reference + due date; buckets computed
 *    client-side so relative dates match the viewer)
 *  - approvals waiting on my decision
 *  - places I've been @mentioned
 *  - my own leave requests still awaiting a decision
 *  - (setters) leads assigned but not yet contacted
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()

  const [workRes, stepsRes, mentionsRes, leaveRes] = await Promise.all([
    admin
      .from("work_items")
      .select("id, reference, title, type, status, priority, due_at")
      .eq("org_id", caller.orgId)
      .eq("assigned_to", caller.employeeId)
      .not("status", "in", "(done,cancelled)")
      .order("due_at", { ascending: true, nullsFirst: false }),
    admin
      .from("approval_steps")
      .select("*, approval:approvals(id, subject_type, status, current_step, requester:fs_employees!approvals_requested_by_fkey(full_name))")
      .eq("approver_id", caller.employeeId)
      .is("decision", null),
    admin
      .from("fs_notifications")
      .select("id, title, message, link, is_read, created_at")
      .eq("recipient_id", caller.employeeId)
      .eq("type", "mention")
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("fs_leave_requests")
      .select("id, reference, leave_type, start_date, end_date, status, created_at")
      .eq("employee_id", caller.employeeId)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ])

  const approvalsWaiting = (stepsRes.data ?? []).filter((s) => {
    const a = (s as { approval?: { status: string; current_step: number } }).approval
    return a && a.status === "pending" && a.current_step === s.step_number
  })

  // Setters: leads assigned but still "new"
  let uncontactedLeads: { id: string; full_name: string; phone_e164: string }[] = []
  if (caller.role === "setter") {
    const { data: leads } = await admin
      .from("leads")
      .select("id, full_name, phone_e164")
      .eq("org_id", caller.orgId)
      .eq("assigned_to", caller.employeeId)
      .eq("status", "new")
      .order("last_enquiry_at", { ascending: false })
      .limit(50)
    uncontactedLeads = leads ?? []
  }

  return NextResponse.json({
    open: workRes.data ?? [],
    approvalsWaiting,
    mentions: mentionsRes.data ?? [],
    myLeaveRequests: leaveRes.data ?? [],
    uncontactedLeads,
  })
}
