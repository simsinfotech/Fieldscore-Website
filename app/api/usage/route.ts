import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/usage?period=YYYY-MM-DD
 * Returns current period usage meters. Admin only.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const url = request.nextUrl
  const periodParam = url.searchParams.get("period")

  // Default to first of current month
  const now = new Date()
  const period = periodParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`

  const { data: meters, error } = await admin
    .from("usage_meters")
    .select("*")
    .eq("org_id", caller.orgId)
    .eq("period", period)
    .maybeSingle()

  if (error) {
    console.error("usage query error:", error)
    return NextResponse.json({ error: "Failed to fetch usage data" }, { status: 500 })
  }

  if (!meters) {
    // No usage recorded yet this period — return zeroes
    return NextResponse.json({
      usage: {
        org_id: caller.orgId,
        period,
        seats: 0,
        calls_count: 0,
        recording_minutes: 0,
        stt_minutes: 0,
        llm_tokens_used: 0,
        storage_gb: 0,
        whatsapp_messages: 0,
        telephony_minutes: 0,
      },
    })
  }

  return NextResponse.json({ usage: meters })
}
