import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { getProvider } from "@/lib/telephony/provider-factory"

interface ConnectBody {
  clientPhone: string
  leadId?: string
}

/**
 * POST /api/calls/connect
 * Initiate a cloud telephony click-to-call: bridges agent's phone to client's phone
 * with server-side recording. Supports Exotel, Plivo, etc. via provider factory.
 */
export async function POST(request: NextRequest) {
  try {
    const caller = await resolveEmployee()
    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json()) as ConnectBody
    const { clientPhone, leadId } = body

    if (!clientPhone) {
      return NextResponse.json(
        { error: "clientPhone is required" },
        { status: 400 }
      )
    }

    const admin = getSupabaseAdmin()

    // Look up agent's phone number
    const { data: employee } = await admin
      .from("fs_employees")
      .select("phone")
      .eq("id", caller.employeeId)
      .single()

    if (!employee?.phone) {
      return NextResponse.json(
        { error: "Agent phone number not configured" },
        { status: 422 }
      )
    }

    // Get telephony provider for this org
    const provider = await getProvider(admin, caller.orgId)
    if (!provider) {
      return NextResponse.json(
        { error: "Cloud telephony not configured for this organization" },
        { status: 422 }
      )
    }

    // Fetch caller ID from fs_telephony_config
    const { data: config } = await admin
      .from("fs_telephony_config")
      .select("caller_id")
      .eq("org_id", caller.orgId)
      .eq("is_active", true)
      .maybeSingle()

    // Build webhook callback URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const webhookSecret =
      provider.name === "plivo"
        ? process.env.PLIVO_WEBHOOK_SECRET
        : process.env.EXOTEL_WEBHOOK_SECRET

    const statusCallback = `${appUrl}/api/webhooks/${provider.name}${
      provider.name === "exotel" && webhookSecret
        ? `?secret=${webhookSecret}`
        : ""
    }${
      provider.name === "plivo"
        ? `/hangup${webhookSecret ? `?secret=${webhookSecret}` : ""}`
        : ""
    }`

    // Initiate call via provider
    const callRef = await provider.createOutboundCall({
      agentPhone: employee.phone,
      clientPhone,
      callerId: config?.caller_id || "",
      record: true,
      statusCallbackUrl: statusCallback,
      metadata: leadId ? { leadId } : undefined,
    })

    // Insert call_logs row
    const ingestSource = provider.name === "plivo" ? "plivo" : "exotel"
    const { data: callRow, error: insertError } = await admin
      .from("call_logs")
      .insert({
        org_id: caller.orgId,
        employee_id: caller.employeeId,
        client_number: clientPhone,
        direction: "outbound",
        duration_seconds: 0,
        call_started_at: new Date().toISOString(),
        ingest_source: ingestSource,
        source: "telephony_bridge",
        provider_call_id: callRef.providerCallId,
        lead_id: leadId ?? null,
      })
      .select("id")
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      callId: callRow.id,
      providerCallId: callRef.providerCallId,
      status: "initiated",
    })
  } catch (err: any) {
    console.error("calls/connect error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
