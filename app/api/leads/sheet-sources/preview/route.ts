import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import {
  parseSpreadsheetUrl,
  fetchSheetPreview,
  getSpreadsheetMeta,
  getServiceAccountEmail,
} from "@/lib/google/sheets-client"
import { autoMapColumns } from "@/lib/leads/column-mapper"

/**
 * POST /api/leads/sheet-sources/preview
 * Preview: read headers + first 10 rows from a URL, auto-map columns.
 * No DB write — purely for the wizard.
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
  const { url, sheet_name, header_row } = body

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 })
  }

  let spreadsheetId: string
  try {
    const parsed = parseSpreadsheetUrl(url)
    spreadsheetId = parsed.spreadsheetId
  } catch {
    return NextResponse.json({ error: "Invalid Google Sheets URL" }, { status: 400 })
  }

  try {
    // Get spreadsheet metadata (sheet names)
    const meta = await getSpreadsheetMeta(spreadsheetId)
    const sheets = meta.sheets?.map((s) => s.properties?.title || "") || []

    const targetSheet = sheet_name || sheets[0] || "Sheet1"
    const targetRow = header_row || 1

    // Fetch preview rows
    const { headers, rows } = await fetchSheetPreview(
      spreadsheetId,
      targetSheet,
      targetRow,
      10
    )

    // Auto-map columns
    const columnMap = autoMapColumns(headers)

    // Get SA email for sharing instructions
    const serviceAccountEmail = getServiceAccountEmail()

    return NextResponse.json({
      spreadsheetId,
      title: meta.properties?.title || "Untitled",
      sheets,
      headers,
      rows,
      columnMap,
      serviceAccountEmail,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to access sheet"
    // Common error: sheet not shared with SA
    if (message.includes("403") || message.includes("not found")) {
      return NextResponse.json(
        {
          error:
            "Cannot access this spreadsheet. Please share it with the service account email.",
          serviceAccountEmail: getServiceAccountEmail(),
        },
        { status: 403 }
      )
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
