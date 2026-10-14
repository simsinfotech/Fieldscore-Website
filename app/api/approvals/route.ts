import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/approvals
 * Returns approvals waiting on the caller's decision and the caller's own
 * pending requests.
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()

  const [mineRes, stepsRes] = await Promise.all([
    admin
      .from("approvals")
      .select("*, steps:approval_steps(*)")
      .eq("org_id", caller.orgId)
      .eq("requested_by", caller.employeeId)
      .order("created_at", { ascending: false }),
    admin
      .from("approval_steps")
      .select("*, approval:approvals(*, requester:fs_employees!approvals_requested_by_fkey(id, full_name, avatar_url))")
      .eq("approver_id", caller.employeeId)
      .is("decision", null),
  ])

  // Only steps that are the current step of a still-pending approval.
  const waitingOnMe = (stepsRes.data ?? []).filter((s) => {
    const a = (s as { approval?: { status: string; current_step: number } }).approval
    return a && a.status === "pending" && a.current_step === s.step_number
  })

  return NextResponse.json({
    myRequests: mineRes.data ?? [],
    waitingOnMe,
  })
}

/**
 * POST /api/approvals — raise an approval.
 * body: { subject_type, subject_id?, steps: [{ approver_id? , approver_role? }] }
 * approver_role 'manager' resolves to the requester's manager, 'admin' to
 * an org admin.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json()
  const { subject_type, subject_id, steps } = body as {
    subject_type?: string
    subject_id?: string
    steps?: { approver_id?: string; approver_role?: string }[]
  }

  if (!subject_type || !steps?.length) {
    return NextResponse.json(
      { error: "subject_type and at least one step are required" },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Resolve dynamic approvers
  const { data: me } = await admin
    .from("fs_employees")
    .select("reports_to")
    .eq("id", caller.employeeId)
    .single()

  let orgAdminId: string | null = null
  async function resolveApprover(step: { approver_id?: string; approver_role?: string }) {
    if (step.approver_id) return step.approver_id
    if (step.approver_role === "manager") return me?.reports_to ?? null
    if (step.approver_role === "admin") {
      if (!orgAdminId) {
        const { data: adminEmp } = await admin
          .from("fs_employees")
          .select("id")
          .eq("org_id", caller!.orgId)
          .eq("role", "admin")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle()
        orgAdminId = adminEmp?.id ?? null
      }
      return orgAdminId
    }
    return null
  }

  const { data: approval, error } = await admin
    .from("approvals")
    .insert({
      org_id: caller.orgId,
      subject_type,
      subject_id: subject_id || null,
      requested_by: caller.employeeId,
      status: "pending",
      current_step: 1,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const stepRows = []
  for (let i = 0; i < steps.length; i++) {
    stepRows.push({
      approval_id: approval.id,
      step_number: i + 1,
      approver_id: await resolveApprover(steps[i]),
      approver_role: steps[i].approver_role || null,
    })
  }
  await admin.from("approval_steps").insert(stepRows)

  // If this approves a work item, link and mark it needing approval.
  if (subject_type === "work_item" && subject_id) {
    await admin
      .from("work_items")
      .update({ approval_id: approval.id, requires_approval: true })
      .eq("id", subject_id)
      .eq("org_id", caller.orgId)
  }

  return NextResponse.json({ approval }, { status: 201 })
}
