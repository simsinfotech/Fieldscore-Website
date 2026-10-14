import { createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSheetRows } from "@/lib/google/sheets-client"
import { validateRow } from "./validate-row"
import { notifyNewLeads } from "@/lib/push/send-push"
import { allocateLead } from "./allocation"
import type { LeadSourceSheet } from "@/types"

const LOCK_STALE_MINUTES = 5

/**
 * Sync a single sheet source: read rows, hash-dedup, validate,
 * create leads, handle re-enquiries.
 */
export async function syncSheet(
  admin: SupabaseClient,
  source: LeadSourceSheet
): Promise<{ synced: number; errors: number; skipped: number }> {
  const result = { synced: 0, errors: 0, skipped: 0 }
  const newLeads: { id: string; full_name: string }[] = []

  // ── Acquire lock ──
  if (source.is_syncing) {
    const started = source.sync_started_at
      ? new Date(source.sync_started_at).getTime()
      : 0
    const staleMs = LOCK_STALE_MINUTES * 60 * 1000
    if (Date.now() - started < staleMs) {
      // Another sync is still running
      return result
    }
    // Stale lock — proceed
  }

  await admin
    .from("lead_source_sheets")
    .update({
      is_syncing: true,
      sync_started_at: new Date().toISOString(),
      last_sync_error: null,
    })
    .eq("id", source.id)

  try {
    // ── Fetch rows from Google Sheets ──
    const { headers, rows } = await fetchSheetRows(
      source.spreadsheet_id,
      source.sheet_name,
      source.header_row
    )

    if (headers.length === 0) {
      await releaseLock(admin, source.id, "No headers found in sheet")
      return result
    }

    const columnMap = source.column_map as Record<string, import("./column-mapper").LeadField | "skip">
    let lastRow = 0

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = source.header_row + 1 + i // 1-indexed, after header
      const row = rows[i]

      // Skip empty rows
      if (row.every((cell) => !cell.trim())) continue

      // Build raw data object using headers
      const rawData: Record<string, unknown> = {}
      headers.forEach((h, idx) => {
        rawData[h] = row[idx] ?? ""
      })

      // SHA-256 hash of row contents
      const rowHash = createHash("sha256")
        .update(JSON.stringify(rawData))
        .digest("hex")

      // Check existing sync record
      const { data: existing } = await admin
        .from("sheet_row_sync")
        .select("id, row_hash, status")
        .eq("source_id", source.id)
        .eq("row_number", rowNumber)
        .maybeSingle()

      if (existing && existing.row_hash === rowHash) {
        result.skipped++
        lastRow = Math.max(lastRow, rowNumber)
        continue // Hash unchanged — skip
      }

      // Validate row using the column map
      const validated = validateRow(rawData, columnMap)

      if (!validated.isValid) {
        // Upsert sync record as error
        await admin.from("sheet_row_sync").upsert(
          {
            source_id: source.id,
            row_number: rowNumber,
            row_hash: rowHash,
            status: "error",
            raw_data: rawData,
            parsed_data: validated.parsed,
            errors: validated.errors,
          },
          { onConflict: "source_id,row_number" }
        )
        result.errors++
        lastRow = Math.max(lastRow, rowNumber)
        continue
      }

      // Check for phone dupe in leads table (skip if no phone)
      const phone = validated.parsed.phone_e164
      if (phone) {
        const { data: existingLead } = await admin
          .from("leads")
          .select("id, re_enquiry_count")
          .eq("org_id", source.org_id)
          .eq("phone_e164", phone)
          .neq("status", "junk")
          .maybeSingle()

        if (existingLead) {
          // Bump re-enquiry
          await admin
            .from("leads")
            .update({
              re_enquiry_count: (existingLead.re_enquiry_count || 0) + 1,
              last_enquiry_at: new Date().toISOString(),
            })
            .eq("id", existingLead.id)

          await admin.from("sheet_row_sync").upsert(
            {
              source_id: source.id,
              row_number: rowNumber,
              row_hash: rowHash,
              status: "skipped",
              lead_id: existingLead.id,
              raw_data: rawData,
              parsed_data: validated.parsed,
              errors: [],
            },
            { onConflict: "source_id,row_number" }
          )
          result.skipped++
          lastRow = Math.max(lastRow, rowNumber)
          continue
        }
      }

      // Insert new lead
      const p = validated.parsed
      const { data: newLead, error: insertErr } = await admin
        .from("leads")
        .insert({
          org_id: source.org_id,
          full_name: p.full_name || "Unknown",
          phone_e164: p.phone_e164 || null,
          email: p.email || null,
          project: p.project || null,
          budget_min: p.budget_min || null,
          budget_max: p.budget_max || null,
          budget_raw: p.budget_raw || null,
          city: p.city || null,
          source: "google_sheets",
          source_label: source.label,
          source_sheet_id: source.id,
          status: "new",
          notes: p.notes || null,
          ...(p.created_at ? { created_at: p.created_at } : {}),
        })
        .select("id")
        .single()

      if (insertErr) {
        await admin.from("sheet_row_sync").upsert(
          {
            source_id: source.id,
            row_number: rowNumber,
            row_hash: rowHash,
            status: "error",
            raw_data: rawData,
            parsed_data: validated.parsed,
            errors: [{ field: "insert", message: insertErr.message }],
          },
          { onConflict: "source_id,row_number" }
        )
        result.errors++
      } else {
        // Track new lead for push notification
        newLeads.push({
          id: newLead.id,
          full_name: p.full_name || "Unknown",
        })

        // Auto-assign via round-robin (direct, no approval step)
        try {
          await allocateLead(admin, newLead.id, source.org_id, "google_sheets")
        } catch (allocErr) {
          console.error("sheet-sync: auto-assign failed for lead", newLead.id, allocErr)
        }

        await admin.from("sheet_row_sync").upsert(
          {
            source_id: source.id,
            row_number: rowNumber,
            row_hash: rowHash,
            status: "synced",
            lead_id: newLead.id,
            raw_data: rawData,
            parsed_data: validated.parsed,
            errors: [],
          },
          { onConflict: "source_id,row_number" }
        )
        result.synced++
      }

      lastRow = Math.max(lastRow, rowNumber)
    }

    // Send push notifications for newly synced leads
    await notifyNewLeads(admin, source.org_id, newLeads).catch(() => {
      // Notification delivery is best-effort — don't fail the sync
    })

    // Update cursor
    await admin
      .from("lead_source_sheets")
      .update({
        last_synced_at: new Date().toISOString(),
        last_sync_row: lastRow,
        is_syncing: false,
        sync_started_at: null,
        last_sync_error: null,
      })
      .eq("id", source.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown sync error"
    await releaseLock(admin, source.id, message)
  }

  return result
}

async function releaseLock(
  admin: SupabaseClient,
  sourceId: string,
  error: string | null
) {
  await admin
    .from("lead_source_sheets")
    .update({
      is_syncing: false,
      sync_started_at: null,
      last_sync_error: error,
    })
    .eq("id", sourceId)
}
