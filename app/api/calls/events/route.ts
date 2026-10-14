import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { fireTrigger } from "@/lib/workflows/engine"

interface CallEventPayload {
  phone: string
  direction: "inbound" | "outbound" | "missed"
  duration_seconds: number
  call_started_at: string
  call_ended_at?: string
  device_id: string
  sim_slot?: number
  provider_call_id?: string
  recording_status?: string
}

/**
 * POST /api/calls/events
 * Receive real-time call lifecycle events from mobile.
 * Used by SyncQueue for offline-safe call event delivery.
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as CallEventPayload

  if (!body.phone || !body.direction || !body.call_started_at || !body.device_id) {
    return NextResponse.json(
      { error: "phone, direction, call_started_at, and device_id are required" },
      { status: 400 }
    )
  }

  const admin = getSupabaseAdmin()

  // Resolve device internal ID from device_id string
  const { data: device } = await admin
    .from("call_devices")
    .select("id")
    .eq("device_id", body.device_id)
    .eq("employee_id", caller.employeeId)
    .maybeSingle()

  if (!device) {
    return NextResponse.json({ error: "Device not registered" }, { status: 400 })
  }

  // Match lead by phone number
  const { data: lead } = await admin
    .from("leads")
    .select("id")
    .eq("org_id", caller.orgId)
    .eq("phone_e164", body.phone)
    .maybeSingle()

  // Idempotent upsert — dedup by device + timestamp + number
  const { data: callLog, error } = await admin
    .from("call_logs")
    .upsert(
      {
        org_id: caller.orgId,
        employee_id: caller.employeeId,
        device_id: device.id,
        client_number: body.phone,
        direction: body.direction,
        duration_seconds: body.duration_seconds || 0,
        call_started_at: body.call_started_at,
        ingest_source: "own_app",
        lead_id: lead?.id || null,
        provider_call_id: body.provider_call_id || null,
        recording_status: body.recording_status || "not_available",
      },
      { onConflict: "device_id,call_started_at,client_number", ignoreDuplicates: false }
    )
    .select("id")
    .single()

  if (error) {
    console.error("call event upsert error:", error)
    return NextResponse.json({ error: "Failed to record call event" }, { status: 500 })
  }

  // Recompute daily rollup
  const date = body.call_started_at.split("T")[0]
  await admin.rpc("recompute_call_daily", {
    p_employee_id: caller.employeeId,
    p_date: date,
  })

  // Fire workflow triggers
  if (lead?.id) {
    const trigger = body.direction === "missed" ? "call_missed" : "call_completed"
    fireTrigger({
      orgId: caller.orgId,
      trigger,
      entityType: "lead",
      entityId: lead.id,
      data: {
        call_id: callLog.id,
        direction: body.direction,
        duration_seconds: body.duration_seconds,
        phone: body.phone,
      },
      actorId: caller.employeeId,
    }).catch((err) => console.error(`workflow: ${trigger} trigger failed`, err))
  }

  return NextResponse.json({ call_id: callLog.id }, { status: 201 })
}
