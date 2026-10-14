import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * POST /api/eod/[id]/review  (manager of the author, or admin)
 * Marks an EOD report reviewed with an optional comment — the "forward to
 * admin" step. Admins see all EODs with the review status + comment.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!caller.isAdmin && caller.role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const { comment } = await request.json().catch(() => ({}))
  const admin = getSupabaseAdmin()

  const { data: eod } = await admin
    .from("fs_eod_reports")
    .select("id, employee_id")
    .eq("id", id)
    .maybeSingle()
  if (!eod) return NextResponse.json({ error: "Report not found" }, { status: 404 })

  // A manager may only review their own subtree's reports.
  if (!caller.isAdmin) {
    const { data: sub } = await admin.rpc("subtree_ids", { p_root: caller.employeeId })
    const ids = (sub ?? []).map((s: { id: string }) => s.id)
    if (!ids.includes(eod.employee_id)) {
      return NextResponse.json({ error: "Not your team member" }, { status: 403 })
    }
  }

  const { error } = await admin
    .from("fs_eod_reports")
    .update({
      review_status: "reviewed",
      reviewed_by: caller.employeeId,
      manager_comment: comment?.trim() || null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Notify the report author their EOD was reviewed.
  await admin.from("fs_notifications").insert({
    recipient_id: eod.employee_id,
    type: "eod_reviewed",
    title: "Your EOD was reviewed",
    message: comment?.trim() ? `Manager note: ${comment.trim()}` : "Your manager reviewed your EOD report.",
    link: "/eod-reports",
  })

  return NextResponse.json({ success: true })
}
