import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import type { TodayActivity } from "@/types"

export async function GET() {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = getSupabaseAdmin()
    const today = new Date().toISOString().split("T")[0]
    const dayStart = `${today}T00:00:00.000Z`
    const dayEnd = `${today}T23:59:59.999Z`

    // Fetch today's sessions and active minutes in parallel
    const [sessionsRes, minutesRes] = await Promise.all([
      admin
        .from("attendance_sessions")
        .select("*")
        .eq("employee_id", caller.employeeId)
        .gte("started_at", dayStart)
        .lte("started_at", dayEnd)
        .order("started_at", { ascending: true }),
      admin
        .from("activity_minutes")
        .select("bucket")
        .eq("employee_id", caller.employeeId)
        .gte("bucket", dayStart)
        .lte("bucket", dayEnd)
        .order("bucket", { ascending: true }),
    ])

    const sessions = sessionsRes.data || []
    const minutes = minutesRes.data || []

    const openSession = sessions.find((s) => !s.ended_at) || null

    const result: TodayActivity = {
      sessions,
      openSession,
      activeMinutes: minutes.length,
      minuteBuckets: minutes.map((m) => m.bucket),
    }

    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
