import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { fireTrigger } from "@/lib/workflows/engine"
import { allocateLead } from "@/lib/leads/allocation"

export async function POST(request: NextRequest) {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!caller.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = getSupabaseAdmin()
  const { batchId } = await request.json()

  if (!batchId) {
    return NextResponse.json({ error: "batchId is required" }, { status: 400 })
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

  // Fetch valid rows (non-duplicate)
  const { data: validRows } = await admin
    .from("lead_batch_rows")
    .select("*")
    .eq("batch_id", batchId)
    .eq("is_valid", true)
    .eq("is_duplicate", false)

  // Fetch duplicate rows (for re-enquiry handling)
  const { data: dupeRows } = await admin
    .from("lead_batch_rows")
    .select("*")
    .eq("batch_id", batchId)
    .eq("is_duplicate", true)

  let insertedCount = 0
  let reEnquiryCount = 0

  // Every uploaded lead carries the file's title as its project label.
  const projectTitle =
    (batch.file_name || "").replace(/\.[^.]+$/, "").trim() || null

  // Insert valid new leads
  if (validRows && validRows.length > 0) {
    const leadsToInsert = validRows.map((row) => {
      const p = row.parsed_data || {}
      return {
        org_id: caller.orgId,
        batch_id: batchId,
        full_name: p.full_name || "Unknown",
        phone_e164: p.phone_e164 || null,
        phone_raw: row.raw_data?.phone || row.raw_data?.["Phone Number"] || null,
        email: p.email || null,
        project: p.project || null,
        budget_min: p.budget_min || null,
        budget_max: p.budget_max || null,
        budget_raw: p.budget_raw || null,
        city: p.city || null,
        source: "excel",
        source_label: projectTitle,
        status: "new",
        notes: p.notes || null,
      }
    })

    const CHUNK_SIZE = 500
    for (let i = 0; i < leadsToInsert.length; i += CHUNK_SIZE) {
      const chunk = leadsToInsert.slice(i, i + CHUNK_SIZE)
      const { data, error } = await admin.from("leads").insert(chunk).select("id")
      if (error) {
        console.error("Failed to insert leads:", error)
      } else {
        insertedCount += (data?.length || 0)
        // Auto-assign each new lead via round-robin
        for (const lead of data || []) {
          try {
            await allocateLead(admin, lead.id, caller.orgId, "excel")
          } catch (allocErr) {
            console.error("commit: auto-assign failed for lead", lead.id, allocErr)
          }
        }
      }
    }
  }

  // Handle duplicates: bump re_enquiry_count and update last_enquiry_at
  if (dupeRows && dupeRows.length > 0) {
    for (const row of dupeRows) {
      if (row.existing_lead_id) {
        // Fetch current count, then increment
        const { data: existingLead } = await admin
          .from("leads")
          .select("re_enquiry_count")
          .eq("id", row.existing_lead_id)
          .single()

        if (existingLead) {
          await admin
            .from("leads")
            .update({
              re_enquiry_count: (existingLead.re_enquiry_count || 0) + 1,
              last_enquiry_at: new Date().toISOString(),
            })
            .eq("id", row.existing_lead_id)

          reEnquiryCount++
        }
      }
    }
  }

  // Update batch status
  await admin
    .from("lead_batches")
    .update({ status: "committed" })
    .eq("id", batchId)

  // Fire workflow triggers for newly created leads
  if (validRows && validRows.length > 0) {
    const { data: newLeads } = await admin
      .from("leads")
      .select("id, full_name, source, status")
      .eq("batch_id", batchId)
      .eq("org_id", caller.orgId)

    for (const lead of newLeads || []) {
      fireTrigger({
        orgId: caller.orgId,
        trigger: "lead_created",
        entityType: "lead",
        entityId: lead.id,
        data: {
          source: lead.source,
          status: lead.status,
          full_name: lead.full_name,
          batch_id: batchId,
        },
        actorId: caller.employeeId,
      }).catch((err) => console.error("workflow: lead_created trigger failed", err))
    }
  }

  return NextResponse.json({
    success: true,
    inserted: insertedCount,
    reEnquiries: reEnquiryCount,
    batchId,
  })
}
