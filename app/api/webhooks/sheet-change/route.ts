import { NextRequest, NextResponse } from "next/server"
import { createHmac } from "crypto"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { syncSheet } from "@/lib/leads/sheet-sync"
import type { LeadSourceSheet } from "@/types"

/**
 * POST /api/webhooks/sheet-change
 * Webhook from Google Apps Script — HMAC verified, triggers syncSheet().
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const signature = request.headers.get("x-webhook-signature")

  if (!body || !signature) {
    return NextResponse.json({ error: "Missing body or signature" }, { status: 400 })
  }

  let payload: { spreadsheetId: string; sheetName: string }
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Find matching source by spreadsheetId + sheetName
  const { data: source } = await admin
    .from("lead_source_sheets")
    .select("*")
    .eq("spreadsheet_id", payload.spreadsheetId)
    .eq("sheet_name", payload.sheetName)
    .eq("is_active", true)
    .maybeSingle()

  if (!source) {
    return NextResponse.json({ error: "Source not found" }, { status: 404 })
  }

  const typedSource = source as LeadSourceSheet

  // Verify HMAC
  if (typedSource.webhook_secret) {
    const expected = createHmac("sha256", typedSource.webhook_secret)
      .update(body)
      .digest("hex")

    if (signature !== expected) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
    }
  }

  // Trigger sync
  const result = await syncSheet(admin, typedSource)

  return NextResponse.json({ success: true, ...result })
}
