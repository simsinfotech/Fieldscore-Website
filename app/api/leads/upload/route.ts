import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { autoMapColumns } from "@/lib/leads/column-mapper"
import { validateRow } from "@/lib/leads/validate-row"
import * as XLSX from "xlsx"

export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin && caller.role !== "sales_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ]
    const ext = file.name.split(".").pop()?.toLowerCase()
    if (!validTypes.includes(file.type) && !["xlsx", "xls", "csv"].includes(ext || "")) {
      return NextResponse.json(
        { error: "Invalid file type. Upload .xlsx, .xls, or .csv" },
        { status: 400 }
      )
    }

    // Read file into buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Compute SHA-256 hash for deduplication
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    const fileHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")

    // Check for duplicate upload in this org
    const { data: existing } = await admin
      .from("lead_batches")
      .select("id, file_name, status, created_at")
      .eq("org_id", caller.orgId)
      .eq("file_hash", fileHash)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          error: "This file has already been uploaded",
          existingBatch: existing,
        },
        { status: 409 }
      )
    }

    // Upload file to Supabase Storage
    const storagePath = `${caller.orgId}/${fileHash}-${file.name}`
    await admin.storage.from("lead-uploads").upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

    // Parse with SheetJS
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    })

    if (rows.length === 0) {
      return NextResponse.json({ error: "File is empty or has no data rows" }, { status: 400 })
    }

    // Auto-map columns
    const fileColumns = Object.keys(rows[0])
    const columnMap = autoMapColumns(fileColumns)

    // Create batch record
    const { data: batch, error: batchError } = await admin
      .from("lead_batches")
      .insert({
        org_id: caller.orgId,
        uploaded_by: caller.employeeId,
        file_name: file.name,
        file_hash: fileHash,
        storage_path: storagePath,
        status: "pending",
        total_rows: rows.length,
        column_map: columnMap,
      })
      .select()
      .single()

    if (batchError || !batch) {
      return NextResponse.json(
        { error: "Failed to create batch record" },
        { status: 500 }
      )
    }

    // Validate all rows and check for duplicates
    const batchRows = []
    let validCount = 0
    let dupeCount = 0
    let errorCount = 0

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

    // Track phones within this batch for intra-batch dupes
    const batchPhones = new Map<string, number>()

    for (let i = 0; i < rows.length; i++) {
      const rawData = rows[i]
      const result = validateRow(rawData, columnMap)

      let isDuplicate = false
      let existingLeadId: string | undefined

      if (result.parsed.phone_e164) {
        // Check against existing leads in DB
        const existingId = existingPhoneMap.get(result.parsed.phone_e164)
        if (existingId) {
          isDuplicate = true
          existingLeadId = existingId
        }

        // Check against earlier rows in this batch
        const prevRow = batchPhones.get(result.parsed.phone_e164)
        if (prevRow !== undefined) {
          isDuplicate = true
          result.errors.push({
            field: "phone",
            message: `Duplicate of row ${prevRow + 1} in this file`,
          })
        } else {
          batchPhones.set(result.parsed.phone_e164, i)
        }
      }

      const isValid = result.isValid && !isDuplicate

      if (isDuplicate) dupeCount++
      else if (!result.isValid) errorCount++
      else validCount++

      batchRows.push({
        batch_id: batch.id,
        row_number: i + 1,
        raw_data: rawData,
        parsed_data: result.parsed,
        errors: result.errors,
        is_valid: isValid,
        is_duplicate: isDuplicate,
        existing_lead_id: existingLeadId || null,
      })
    }

    // Insert batch rows in chunks
    const CHUNK_SIZE = 500
    for (let i = 0; i < batchRows.length; i += CHUNK_SIZE) {
      const chunk = batchRows.slice(i, i + CHUNK_SIZE)
      const { error: rowError } = await admin.from("lead_batch_rows").insert(chunk)
      if (rowError) {
        console.error("Failed to insert batch rows:", rowError)
      }
    }

    // Update batch with counts and status
    await admin
      .from("lead_batches")
      .update({
        status: "validated",
        valid_rows: validCount,
        dupe_rows: dupeCount,
        error_rows: errorCount,
      })
      .eq("id", batch.id)

    return NextResponse.json(
      {
        batch: {
          ...batch,
          status: "validated",
          valid_rows: validCount,
          dupe_rows: dupeCount,
          error_rows: errorCount,
        },
        columnMap,
        fileColumns,
        preview: batchRows.slice(0, 20).map((r) => ({
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
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("Upload error:", err)
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    )
  }
}
