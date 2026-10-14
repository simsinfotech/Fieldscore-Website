import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { parseSpreadsheetUrl } from "@/lib/google/sheets-client"

/**
 * GET /api/leads/sheet-sources
 * List all sheet sources for the caller's org (admin only).
 */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { data: sources, error } = await admin
    .from("lead_source_sheets")
    .select("*")
    .eq("org_id", caller.orgId)
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: "Failed to fetch sources" }, { status: 500 })
  }

  return NextResponse.json({ sources: sources || [] })
}

/**
 * POST /api/leads/sheet-sources
 * Create a new sheet source (admin only).
 */
export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { url, label, sheet_name, header_row, column_map } = body

  if (!url || !label) {
    return NextResponse.json(
      { error: "url and label are required" },
      { status: 400 }
    )
  }

  let spreadsheetId: string
  try {
    const parsed = parseSpreadsheetUrl(url)
    spreadsheetId = parsed.spreadsheetId
  } catch {
    return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Check for existing source with same spreadsheet + sheet
  const sheetName = sheet_name || "Sheet1"
  const { data: existing } = await admin
    .from("lead_source_sheets")
    .select("id")
    .eq("org_id", caller.orgId)
    .eq("spreadsheet_id", spreadsheetId)
    .eq("sheet_name", sheetName)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: "This sheet is already connected" },
      { status: 409 }
    )
  }

  const webhookSecret = randomBytes(32).toString("hex")

  const { data: source, error } = await admin
    .from("lead_source_sheets")
    .insert({
      org_id: caller.orgId,
      label,
      spreadsheet_id: spreadsheetId,
      sheet_name: sheetName,
      header_row: header_row || 1,
      column_map: column_map || {},
      webhook_secret: webhookSecret,
      created_by: caller.employeeId,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ source }, { status: 201 })
}
