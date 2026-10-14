import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/** GET /api/departments — departments for the caller's org. */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from("departments")
    .select("id, key, name, head_id")
    .eq("org_id", caller.orgId)
    .order("name")

  return NextResponse.json({ departments: data ?? [] })
}
