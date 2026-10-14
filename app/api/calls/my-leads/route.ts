import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/calls/my-leads
 * Returns leads assigned to the authenticated employee.
 * Used by the dialer's contact search.
 *
 * Query params:
 *   q - optional search query (matches name or phone)
 *   limit - max results (default 50, max 200)
 */
export async function GET(request: NextRequest) {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get("q")?.trim() ?? ""
    const limit = Math.min(
      Number(searchParams.get("limit")) || 50,
      200
    )

    const admin = getSupabaseAdmin()

    let query = admin
      .from("leads")
      .select("id, full_name, phone_e164, phone_raw, status, project, city")
      .eq("org_id", caller.orgId)
      .eq("assigned_to", caller.employeeId)
      .neq("status", "junk")
      .order("updated_at", { ascending: false })
      .limit(limit)

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,phone_e164.ilike.%${q}%,phone_raw.ilike.%${q}%`)
    }

    const { data: leads, error } = await query

    if (error) throw error

    return NextResponse.json({ leads: leads ?? [] })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
