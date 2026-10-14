import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * POST /api/approvals/[id]/decide
 * body: { decision: 'approved'|'rejected', comment? }
 * The current step's approver (or an admin) decides. Approve advances to
 * the next step or resolves the approval; reject resolves immediately.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { decision, comment } = await request.json()
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json({ error: "decision must be approved|rejected" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: approval } = await admin
    .from("approvals")
    .select("*, steps:approval_steps(*)")
    .eq("id", id)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!approval) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (approval.status !== "pending") {
    return NextResponse.json({ error: "Approval already resolved" }, { status: 409 })
  }

  const steps = (approval.steps as { id: string; step_number: number; approver_id: string | null }[])
    .sort((a, b) => a.step_number - b.step_number)
  const current = steps.find((s) => s.step_number === approval.current_step)
  if (!current) return NextResponse.json({ error: "No current step" }, { status: 409 })

  if (!caller.isAdmin && current.approver_id !== caller.employeeId) {
    return NextResponse.json({ error: "Not your decision to make" }, { status: 403 })
  }

  const now = new Date().toISOString()
  await admin
    .from("approval_steps")
    .update({ decision, comment: comment || null, decided_at: now })
    .eq("id", current.id)

  let newStatus = approval.status
  const updates: Record<string, unknown> = {}
  if (decision === "rejected") {
    newStatus = "rejected"
    updates.status = "rejected"
    updates.resolved_at = now
  } else {
    const hasNext = steps.some((s) => s.step_number > approval.current_step)
    if (hasNext) {
      updates.current_step = approval.current_step + 1
    } else {
      newStatus = "approved"
      updates.status = "approved"
      updates.resolved_at = now
    }
  }

  await admin.from("approvals").update(updates).eq("id", id)

  // Reflect a resolved work-item approval back onto the item.
  if (approval.subject_type === "work_item" && approval.subject_id && newStatus !== "pending") {
    await admin
      .from("work_items")
      .update({ status: newStatus === "approved" ? "approved" : "blocked" })
      .eq("id", approval.subject_id)
  }

  return NextResponse.json({ status: newStatus })
}
