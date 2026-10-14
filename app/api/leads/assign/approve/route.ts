import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { distributeToSetters } from "@/lib/leads/distribute"

/**
 * POST /api/leads/assign/approve  (manager, or admin on a manager's behalf)
 * body: { leadIds?: string[], managerId?: string }
 * Approves the manager's pending leads and round-robin distributes them to
 * the setters in their subtree.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const leadIds: string[] | undefined = body.leadIds

  let managerId: string | null = null
  if (caller.role === "manager") {
    managerId = caller.employeeId
  } else if (caller.isAdmin) {
    managerId = body.managerId || null
    if (!managerId) {
      return NextResponse.json({ error: "managerId is required for admin approval" }, { status: 400 })
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { distributed, setters } = await distributeToSetters(
    admin,
    managerId,
    caller.orgId,
    leadIds
  )

  if (setters === 0) {
    return NextResponse.json(
      { error: "No active setters found under this manager", distributed: 0 },
      { status: 409 }
    )
  }

  // Per-setter private instruction notes (each setter only sees their own).
  const notes: Record<string, string> = body.notes || {}
  const noteEntries = Object.entries(notes).filter(([, t]) => t && String(t).trim())
  if (noteEntries.length) {
    const { data: sub } = await admin.rpc("subtree_ids", { p_root: managerId })
    const validIds = new Set((sub ?? []).map((s: { id: string }) => s.id))
    const rows = noteEntries
      .filter(([sid]) => validIds.has(sid))
      .map(([sid, text]) => ({
        recipient_id: sid,
        type: "lead_instruction",
        title: "New leads + instructions from your manager",
        message: String(text).trim(),
        link: "/leads",
      }))
    if (rows.length) await admin.from("fs_notifications").insert(rows)
  }

  return NextResponse.json({ distributed, setters })
}
