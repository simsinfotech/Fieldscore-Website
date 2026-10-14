import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { validateRow } from "@/lib/leads/validate-row"
import type { LeadField } from "@/lib/leads/column-mapper"

export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { batchId, columnMap } = (await request.json()) as {
    batchId: string
    columnMap: Record<string, LeadField | "skip">
  }

  if (!batchId || !columnMap) {
    return NextResponse.json(
      { error: "batchId and columnMap are required" },
      { status: 400 }
    )
  }

  // Fetch batch
  const { data: batch } = await admin
    .from("lead_batches")
    .select("*")
    .eq("id", batchId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 })
  }

  if (batch.status === "committed") {
    return NextResponse.json({ error: "Batch already committed" }, { status: 409 })
  }

  // Fetch all batch rows
  const { data: rows } = await admin
    .from("lead_batch_rows")
    .select("*")
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true })

  if (!rows || rows.length === 0) {
    return NextResponse.json({ error: "No rows found" }, { status: 404 })
  }

  // Fetch existing leads for dupe check
  const { data: existingLeads } = await admin
    .from("leads")
    .select("id, phone_e164")
    .eq("org_id", caller.orgId)
    .neq("status", "junk")

  const existingPhoneMap = new Map<string, string>()
  if (existingLeads) {
    for (const lead of existingLeads) {
      if (lead.phone_e164) existingPhoneMap.set(lead.phone_e164, lead.id)
    }
  }

  // Re-validate all rows with new column mapping
  let validCount = 0
  let dupeCount = 0
  let errorCount = 0
  const batchPhones = new Map<string, number>()

  for (const row of rows) {
    const result = validateRow(row.raw_data, columnMap)

    let isDuplicate = false
    let existingLeadId: string | null = null

    if (result.parsed.phone_e164) {
      const existingId = existingPhoneMap.get(result.parsed.phone_e164)
      if (existingId) {
        isDuplicate = true
        existingLeadId = existingId
      }

      const prevRow = batchPhones.get(result.parsed.phone_e164)
      if (prevRow !== undefined) {
        isDuplicate = true
        result.errors.push({
          field: "phone",
          message: `Duplicate of row ${prevRow} in this file`,
        })
      } else {
        batchPhones.set(result.parsed.phone_e164, row.row_number)
      }
    }

    const isValid = result.isValid && !isDuplicate

    if (isDuplicate) dupeCount++
    else if (!result.isValid) errorCount++
    else validCount++

    await admin
      .from("lead_batch_rows")
      .update({
        parsed_data: result.parsed,
        errors: result.errors,
        is_valid: isValid,
        is_duplicate: isDuplicate,
        existing_lead_id: existingLeadId,
      })
      .eq("id", row.id)
  }

  // Update batch with new column map and counts
  await admin
    .from("lead_batches")
    .update({
      column_map: columnMap,
      valid_rows: validCount,
      dupe_rows: dupeCount,
      error_rows: errorCount,
      status: "validated",
    })
    .eq("id", batchId)

  // Return updated preview
  const { data: updatedRows } = await admin
    .from("lead_batch_rows")
    .select("*")
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true })
    .limit(20)

  return NextResponse.json({
    batch: {
      ...batch,
      column_map: columnMap,
      status: "validated",
      valid_rows: validCount,
      dupe_rows: dupeCount,
      error_rows: errorCount,
    },
    preview: (updatedRows || []).map((r) => ({
      row_number: r.row_number,
      raw_data: r.raw_data,
      parsed_data: r.parsed_data,
      errors: r.errors,
      is_valid: r.is_valid,
      is_duplicate: r.is_duplicate,
    })),
    summary: {
      total: rows.length,
      valid: validCount,
      duplicates: dupeCount,
      errors: errorCount,
    },
  })
}
