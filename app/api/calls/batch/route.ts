import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

interface CallPayload {
  client_number: string
  direction: "inbound" | "outbound" | "missed"
  duration_seconds: number
  call_started_at: string
  ingest_source?: "own_app" | "callyzer"
}

interface BatchBody {
  device_id: string
  device_name?: string
  os_version?: string
  app_version?: string
  calls: CallPayload[]
}

/**
 * POST /api/calls/batch
 * Ingest call metadata from the native call-capture app.
 * - Upserts device heartbeat in call_devices
 * - Inserts calls with ON CONFLICT DO NOTHING (dedup)
 * - Attempts lead matching by phone number
 * - Triggers recompute_call_daily for affected dates
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as BatchBody
    const { device_id, device_name, os_version, app_version, calls } = body

    if (!device_id || !Array.isArray(calls)) {
      return NextResponse.json(
        { error: "device_id and calls[] are required" },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // ── Upsert device heartbeat ──
    const { data: device } = await admin
      .from("call_devices")
      .upsert(
        {
          employee_id: caller.employeeId,
          org_id: caller.orgId,
          device_id,
          device_name: device_name ?? null,
          os_version: os_version ?? null,
          app_version: app_version ?? null,
          last_heartbeat_at: new Date().toISOString(),
          is_active: true,
        },
        { onConflict: "device_id" }
      )
      .select("id")
      .single()

    if (!device) {
      return NextResponse.json(
        { error: "Failed to register device" },
        { status: 500 }
      )
    }

    if (calls.length === 0) {
      return NextResponse.json({ inserted: 0, total: 0 })
    }

    // ── Collect unique client numbers for lead matching ──
    const uniqueNumbers = [...new Set(calls.map((c) => c.client_number))]
    const { data: matchedLeads } = await admin
      .from("leads")
      .select("id, phone_e164")
      .eq("org_id", caller.orgId)
      .in("phone_e164", uniqueNumbers)

    const leadByPhone = new Map<string, string>()
    for (const lead of matchedLeads ?? []) {
      leadByPhone.set(lead.phone_e164, lead.id)
    }

    // ── Insert calls with dedup ──
    const rows = calls.map((c) => ({
      org_id: caller.orgId,
      employee_id: caller.employeeId,
      device_id: device.id,
      client_number: c.client_number,
      direction: c.direction,
      duration_seconds: c.duration_seconds ?? 0,
      call_started_at: c.call_started_at,
      ingest_source: c.ingest_source ?? "own_app",
      lead_id: leadByPhone.get(c.client_number) ?? null,
    }))

    const { data: inserted, error: insertError } = await admin
      .from("call_logs")
      .upsert(rows, {
        onConflict: "device_id,call_started_at,client_number",
        ignoreDuplicates: true,
      })
      .select("id, call_started_at")

    if (insertError) throw insertError

    // ── Recompute daily rollups for affected dates ──
    const affectedDates = new Set<string>()
    for (const row of inserted ?? []) {
      affectedDates.add(row.call_started_at.split("T")[0])
    }
    // Also include dates from the payload in case all were dupes
    for (const c of calls) {
      affectedDates.add(c.call_started_at.split("T")[0])
    }

    for (const d of affectedDates) {
      await admin.rpc("recompute_call_daily", {
        p_employee_id: caller.employeeId,
        p_date: d,
      })
    }

    return NextResponse.json({
      inserted: inserted?.length ?? 0,
      total: calls.length,
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
