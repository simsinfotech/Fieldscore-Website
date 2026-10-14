import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()

  const { data: batches, error } = await admin
    .from("lead_batches")
    .select("*, uploader:fs_employees!lead_batches_uploaded_by_fkey(id, full_name, avatar_url)")
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) {
    console.error("Batches query error:", error)
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 })
  }

  return NextResponse.json({ batches: batches || [] })
}
