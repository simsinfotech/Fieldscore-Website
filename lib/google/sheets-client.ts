import { google, type sheets_v4 } from "googleapis"

let _sheets: sheets_v4.Sheets | null = null
let _sheetsRW: sheets_v4.Sheets | null = null

function getServiceAccountCredentials() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64
  if (!b64) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_JSON_B64. Base64-encode your service account JSON key and add it to .env.local."
    )
  }
  return JSON.parse(Buffer.from(b64, "base64").toString("utf-8"))
}

function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets

  const creds = getServiceAccountCredentials()
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  })

  _sheets = google.sheets({ version: "v4", auth })
  return _sheets
}

function getSheetsClientRW(): sheets_v4.Sheets {
  if (_sheetsRW) return _sheetsRW

  const creds = getServiceAccountCredentials()
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  })

  _sheetsRW = google.sheets({ version: "v4", auth })
  return _sheetsRW
}

/**
 * Returns the service account email so the user knows which
 * email to share the spreadsheet with.
 */
export function getServiceAccountEmail(): string {
  const creds = getServiceAccountCredentials()
  return creds.client_email as string
}

/**
 * Parse a Google Sheets URL into spreadsheetId and optional gid.
 * Supports formats:
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
 *   https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
 */
export function parseSpreadsheetUrl(url: string): {
  spreadsheetId: string
  gid?: string
} {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (!match) {
    throw new Error("Invalid Google Sheets URL")
  }
  const spreadsheetId = match[1]
  const gidMatch = url.match(/[#&]gid=(\d+)/)
  return { spreadsheetId, gid: gidMatch?.[1] }
}

/**
 * Fetch sheet metadata (sheet names, properties).
 */
export async function getSpreadsheetMeta(spreadsheetId: string) {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "properties.title,sheets.properties",
  })
  return res.data
}

/**
 * Fetch rows from a specific sheet.
 * Returns an array of row arrays (string[][]).
 * headerRow is 1-indexed.
 */
export async function fetchSheetRows(
  spreadsheetId: string,
  sheetName: string,
  headerRow: number = 1
): Promise<{ headers: string[]; rows: string[][] }> {
  const sheets = getSheetsClient()

  // Fetch all data starting from the header row
  const range = `'${sheetName}'!${headerRow}:1000000`
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  })

  const values = res.data.values || []
  if (values.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = (values[0] || []).map((h) => String(h).trim())
  const rows = values.slice(1).map((row) =>
    row.map((cell) => (cell !== null && cell !== undefined ? String(cell) : ""))
  )

  return { headers, rows }
}

/**
 * Fetch only the first N rows for preview purposes.
 */
export async function fetchSheetPreview(
  spreadsheetId: string,
  sheetName: string,
  headerRow: number = 1,
  previewRows: number = 10
): Promise<{ headers: string[]; rows: string[][] }> {
  const sheets = getSheetsClient()

  const endRow = headerRow + previewRows
  const range = `'${sheetName}'!${headerRow}:${endRow}`
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING",
  })

  const values = res.data.values || []
  if (values.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = (values[0] || []).map((h) => String(h).trim())
  const rows = values.slice(1).map((row) =>
    row.map((cell) => (cell !== null && cell !== undefined ? String(cell) : ""))
  )

  return { headers, rows }
}

/**
 * Append a single row to a Google Sheet.
 * Uses the read-write scoped client.
 */
export async function appendSheetRow(
  spreadsheetId: string,
  sheetName: string,
  values: string[]
) {
  const sheets = getSheetsClientRW()
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: [values] },
  })
}
