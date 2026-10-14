/**
 * Minimal RFC-4180 CSV serialiser. Quotes fields containing commas,
 * quotes, or newlines and escapes embedded quotes by doubling them.
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined): string => {
    const s = v == null ? "" : String(v)
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.map(escape).join(",")]
  for (const row of rows) lines.push(row.map(escape).join(","))
  return lines.join("\r\n")
}

/** Standard headers for a CSV download response. */
export function csvResponseHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
  }
}
