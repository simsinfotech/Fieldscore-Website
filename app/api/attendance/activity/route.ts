import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/attendance/activity?employeeId=&date=YYYY-MM-DD
 * Minute buckets for one employee on one day, for the heatmap.
 * Self, admin/HR (org), or manager (subtree) only. (T-09)
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId") || caller.employeeId
  const dateParam = request.nextUrl.searchParams.get("date")
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)
    ? dateParam
    : new Date().toISOString().split("T")[0]

  const admin = getSupabaseAdmin()

  // Authorisation: self always; admin sees org; manager sees subtree.
  if (employeeId !== caller.employeeId) {
    if (caller.isAdmin) {
      // org check
      const { data: emp } = await admin
        .from("fs_employees")
        .select("id")
        .eq("id", employeeId)
        .eq("org_id", caller.orgId)
        .maybeSingle()
      if (!emp) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    } else if (caller.role === "manager") {
      const { data: subtree } = await admin.rpc("subtree_ids", {
        p_root: caller.employeeId,
      })
      const ids = (subtree ?? []).map((s: { id: string }) => s.id)
      if (!ids.includes(employeeId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const [minutesRes, sessionsRes] = await Promise.all([
    admin
      .from("activity_minutes")
      .select("bucket")
      .eq("employee_id", employeeId)
      .gte("bucket", `${date}T00:00:00.000Z`)
      .lte("bucket", `${date}T23:59:59.999Z`)
      .order("bucket", { ascending: true }),
    admin
      .from("attendance_sessions")
      .select("id, started_at, ended_at, end_reason")
      .eq("employee_id", employeeId)
      .gte("started_at", `${date}T00:00:00.000Z`)
      .lte("started_at", `${date}T23:59:59.999Z`)
      .order("started_at", { ascending: true }),
  ])

  return NextResponse.json({
    date,
    employeeId,
    buckets: (minutesRes.data ?? []).map((m) => m.bucket),
    sessions: sessionsRes.data ?? [],
  })
}
