import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

interface SendMessageBody {
  lead_id: string
  contact_id?: string
  to: string // phone number
  body?: string
  template_id?: string
  template_params?: Record<string, string>
}

/**
 * POST /api/whatsapp/messages — send a WhatsApp message.
 * Uses WhatsApp Business API (via Twilio or direct Meta API).
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json()) as SendMessageBody

  if (!body.to) {
    return NextResponse.json({ error: "to (phone number) is required" }, { status: 400 })
  }
  if (!body.body && !body.template_id) {
    return NextResponse.json({ error: "body or template_id is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Verify lead belongs to caller's org (if provided)
  if (body.lead_id) {
    const { data: lead } = await admin
      .from("leads")
      .select("id")
      .eq("id", body.lead_id)
      .eq("org_id", caller.orgId)
      .maybeSingle()

    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  // Send via WhatsApp Business API
  const wabaToken = process.env.WHATSAPP_API_TOKEN
  const wabaPhoneId = process.env.WHATSAPP_PHONE_ID

  if (!wabaToken || !wabaPhoneId) {
    return NextResponse.json(
      { error: "WhatsApp Business API not configured" },
      { status: 422 }
    )
  }

  let providerMessageId: string | null = null
  let messageBody = body.body || ""

  try {
    const waPayload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      to: body.to.replace(/[^\d]/g, ""),
      type: body.template_id ? "template" : "text",
    }

    if (body.template_id) {
      waPayload.template = {
        name: body.template_id,
        language: { code: "en" },
        components: body.template_params
          ? [
              {
                type: "body",
                parameters: Object.values(body.template_params).map((v) => ({
                  type: "text",
                  text: v,
                })),
              },
            ]
          : [],
      }
      messageBody = `[Template: ${body.template_id}]`
    } else {
      waPayload.text = { body: body.body }
    }

    const waRes = await fetch(
      `https://graph.facebook.com/v18.0/${wabaPhoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${wabaToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(waPayload),
      }
    )

    if (!waRes.ok) {
      const errData = await waRes.json().catch(() => ({}))
      console.error("WhatsApp API error:", waRes.status, errData)
      return NextResponse.json(
        { error: "Failed to send WhatsApp message", detail: errData },
        { status: 502 }
      )
    }

    const waData = (await waRes.json()) as { messages?: { id: string }[] }
    providerMessageId = waData.messages?.[0]?.id || null
  } catch (err) {
    console.error("WhatsApp send error:", err)
    return NextResponse.json({ error: "WhatsApp API request failed" }, { status: 502 })
  }

  // Store in messages table
  const { data: message, error: insertError } = await admin
    .from("messages")
    .insert({
      org_id: caller.orgId,
      lead_id: body.lead_id || null,
      contact_id: body.contact_id || null,
      channel: "whatsapp",
      direction: "outbound",
      provider_id: providerMessageId,
      template_id: body.template_id || null,
      body: messageBody,
      status: "sent",
    })
    .select("id")
    .single()

  if (insertError) {
    console.error("message insert error:", insertError)
  }

  // Create lead activity
  if (body.lead_id) {
    await admin.from("lead_activities").insert({
      lead_id: body.lead_id,
      actor_id: caller.employeeId,
      type: "whatsapp",
      body: `WhatsApp sent: ${messageBody.slice(0, 200)}`,
    })
  }

  return NextResponse.json({
    message_id: message?.id || null,
    provider_message_id: providerMessageId,
    status: "sent",
  }, { status: 201 })
}

/**
 * GET /api/whatsapp/messages?lead_id=<uuid>
 * List WhatsApp messages for a lead.
 */
export async function GET(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const leadId = request.nextUrl.searchParams.get("lead_id")
  if (!leadId) {
    return NextResponse.json({ error: "lead_id is required" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  const { data: messages, error } = await admin
    .from("messages")
    .select("*")
    .eq("org_id", caller.orgId)
    .eq("lead_id", leadId)
    .eq("channel", "whatsapp")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("whatsapp messages query error:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }

  return NextResponse.json({ messages: messages || [] })
}
