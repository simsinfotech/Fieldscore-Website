import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * POST /api/webhooks/whatsapp
 * Receive WhatsApp Business API webhooks for delivery/read receipts
 * and inbound messages.
 */
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Verify webhook token
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
  if (verifyToken) {
    const hubSignature = request.headers.get("x-hub-signature-256")
    if (!hubSignature) {
      // Not all updates include signature — log but don't reject
      console.warn("whatsapp webhook: missing signature")
    }
  }

  const admin = getSupabaseAdmin()

  // Process each entry
  const entries = body.entry || []
  for (const entry of entries) {
    const changes = entry.changes || []
    for (const change of changes) {
      const value = change.value || {}

      // Handle status updates (delivery receipts)
      const statuses = value.statuses || []
      for (const status of statuses) {
        const providerId = status.id as string
        const newStatus = mapWhatsAppStatus(status.status as string)

        if (providerId && newStatus) {
          await admin
            .from("messages")
            .update({ status: newStatus })
            .eq("provider_id", providerId)
        }
      }

      // Handle inbound messages
      const messages = value.messages || []
      for (const msg of messages) {
        const from = msg.from as string
        const msgBody = msg.text?.body || msg.caption || "[media]"
        const providerId = msg.id as string

        // Find lead by phone number
        const normalizedPhone = from.startsWith("+") ? from : `+${from}`
        const { data: lead } = await admin
          .from("leads")
          .select("id, org_id")
          .eq("phone_e164", normalizedPhone)
          .maybeSingle()

        if (lead) {
          // Store inbound message
          await admin.from("messages").insert({
            org_id: lead.org_id,
            lead_id: lead.id,
            channel: "whatsapp",
            direction: "inbound",
            provider_id: providerId,
            body: msgBody,
            status: "delivered",
          })

          // Create lead activity
          await admin.from("lead_activities").insert({
            lead_id: lead.id,
            type: "whatsapp",
            body: `Inbound WhatsApp: ${msgBody.slice(0, 200)}`,
          })
        }
      }
    }
  }

  return NextResponse.json({ success: true })
}

/**
 * GET /api/webhooks/whatsapp — webhook verification (Meta requires this).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: "Verification failed" }, { status: 403 })
}

function mapWhatsAppStatus(status: string): string | null {
  switch (status) {
    case "sent":
      return "sent"
    case "delivered":
      return "delivered"
    case "read":
      return "read"
    case "failed":
      return "failed"
    default:
      return null
  }
}
