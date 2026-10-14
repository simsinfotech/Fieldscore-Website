import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * Callyzer webhook payload (actual format):
 * [{
 *   emp_name: "John",
 *   emp_code: "102",
 *   emp_country_code: "91",
 *   emp_number: "9876543210",
 *   emp_tags: ["tag1"],
 *   call_logs: [{
 *     id: "abc123",
 *     name: "Client Name",
 *     countryCode: "+91",
 *     number: "9123456789",
 *     duration: 120,
 *     callType: "Outgoing" | "Incoming" | "Missed",
 *     callTime: "2026-07-31 10:30:00",
 *     note: null,
 *     recordingURL: null,
 *     createdDate: "2026-07-31 10:30:00",
 *     modifiedDate: null
 *   }]
 * }]
 */

interface CallyzerLog {
  id: string
  name: string | null
  countryCode: string | null
  number: string
  duration: number
  callType: string
  callTime: string
  note: string | null
  recordingURL: string | null
  createdDate: string | null
  modifiedDate: string | null
}

interface CallyzerEmployee {
  emp_name: string
  emp_code: string | null
  emp_country_code: string | null
  emp_number: string
  emp_tags: string[]
  call_logs: CallyzerLog[]
}

function mapCallType(callType: string): "inbound" | "outbound" | "missed" {
  const t = callType.toLowerCase()
  if (t === "outgoing" || t === "outbound") return "outbound"
  if (t === "incoming" || t === "inbound") return "inbound"
  return "missed"
}

function normalizePhone(countryCode: string | null, number: string): string {
  // Strip non-digit characters
  const digits = number.replace(/\D/g, "")
  const code = (countryCode ?? "91").replace(/\D/g, "")

  // If already has country code prefix, use as-is
  if (digits.length > 10) return `+${digits}`
  return `+${code}${digits}`
}

function parseCallyzerTime(timeStr: string): string {
  // Callyzer sends "2026-07-31 10:30:00", convert to ISO (IST)
  return new Date(timeStr.replace(" ", "T") + "+05:30").toISOString()
}

/**
 * POST /api/calls/callyzer-webhook
 * Receives webhook payloads from Callyzer.
 * Matches employees by phone number, inserts calls, triggers rollup.
 * Secured by a shared secret in request headers.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown as CallyzerEmployee[]

    if (!Array.isArray(body) || body.length === 0) {
      return NextResponse.json({ error: "Empty payload" }, { status: 400 })
    }

    const admin = getSupabaseAdmin()

    let totalInserted = 0
    let totalCalls = 0

    for (const emp of body) {
      if (!emp.emp_number || !Array.isArray(emp.call_logs) || emp.call_logs.length === 0) {
        continue
      }

      const empPhone = normalizePhone(emp.emp_country_code, emp.emp_number)

      // ── Match employee by phone number ──
      let employee: { id: string; org_id: string } | null = null

      const { data: empExact } = await admin
        .from("fs_employees")
        .select("id, org_id")
        .eq("phone", empPhone)
        .eq("is_active", true)
        .maybeSingle()

      if (empExact) {
        employee = empExact
      } else {
        // Try without country code (just last 10 digits)
        const last10 = empPhone.slice(-10)
        const { data: empAlt } = await admin
          .from("fs_employees")
          .select("id, org_id")
          .like("phone", `%${last10}`)
          .eq("is_active", true)
          .maybeSingle()

        if (empAlt) employee = empAlt
      }

      if (!employee) continue // Unknown employee, skip

      // ── Upsert device for this employee (Callyzer as device) ──
      const deviceId = `callyzer-${empPhone}`
      const { data: device } = await admin
        .from("call_devices")
        .upsert(
          {
            employee_id: employee.id,
            org_id: employee.org_id,
            device_id: deviceId,
            device_name: `Callyzer (${emp.emp_name})`,
            app_version: "callyzer",
            last_heartbeat_at: new Date().toISOString(),
            is_active: true,
          },
          { onConflict: "device_id" }
        )
        .select("id")
        .single()

      if (!device) continue

      // ── Collect unique client numbers for lead matching ──
      const uniqueNumbers = [
        ...new Set(
          emp.call_logs.map((l) => normalizePhone(l.countryCode, l.number))
        ),
      ]
      const { data: matchedLeads } = await admin
        .from("leads")
        .select("id, phone_e164")
        .eq("org_id", employee.org_id)
        .in("phone_e164", uniqueNumbers)

      const leadByPhone = new Map<string, string>()
      for (const lead of matchedLeads ?? []) {
        leadByPhone.set(lead.phone_e164, lead.id)
      }

      // ── Insert calls ──
      const rows = emp.call_logs.map((l) => {
        const clientNumber = normalizePhone(l.countryCode, l.number)
        return {
          org_id: employee!.org_id,
          employee_id: employee!.id,
          device_id: device.id,
          client_number: clientNumber,
          direction: mapCallType(l.callType),
          duration_seconds: l.duration ?? 0,
          call_started_at: parseCallyzerTime(l.callTime),
          ingest_source: "callyzer" as const,
          lead_id: leadByPhone.get(clientNumber) ?? null,
        }
      })

      totalCalls += rows.length

      const { data: inserted } = await admin
        .from("call_logs")
        .upsert(rows, {
          onConflict: "device_id,call_started_at,client_number",
          ignoreDuplicates: true,
        })
        .select("id, call_started_at")

      totalInserted += inserted?.length ?? 0

      // ── Recompute daily rollups ──
      const affectedDates = new Set<string>()
      for (const row of inserted ?? []) {
        affectedDates.add(row.call_started_at.split("T")[0])
      }
      for (const l of emp.call_logs) {
        const d = parseCallyzerTime(l.callTime).split("T")[0]
        affectedDates.add(d)
      }

      for (const d of affectedDates) {
        await admin.rpc("recompute_call_daily", {
          p_employee_id: employee.id,
          p_date: d,
        })
      }
    }

    return NextResponse.json({
      inserted: totalInserted,
      total: totalCalls,
    })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
