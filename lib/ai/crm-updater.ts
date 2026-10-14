import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { logAudit } from "@/lib/audit/log"
import type { ExtractionResult } from "./extract"

/** Fields that AI can auto-update when confidence is high. */
const AUTO_UPDATE_FIELDS = [
  "budget_min",
  "budget_max",
  "configuration",
  "preferred_locations",
  "purpose",
  "financing",
  "possession_timeline",
  "decision_makers",
  "temperature",
]

/** Fields that are sensitive — always require human review. */
const SENSITIVE_FIELDS = ["status", "assigned_to", "score"]

const HIGH_CONFIDENCE_THRESHOLD = 0.85

/**
 * Apply AI extraction results to the CRM.
 *
 * High confidence (≥0.85) + non-sensitive field → auto-update lead.
 * Low confidence or sensitive field → create "AI suggestion" activity.
 * Every change logged to audit_events with provenance.
 */
export async function applyCrmUpdates(
  callId: string,
  leadId: string,
  orgId: string,
  employeeId: string,
  extraction: ExtractionResult
): Promise<{
  autoUpdated: string[]
  suggested: string[]
}> {
  const admin = getSupabaseAdmin()
  const autoUpdated: string[] = []
  const suggested: string[] = []

  if (!extraction.lead_updates || Object.keys(extraction.lead_updates).length === 0) {
    return { autoUpdated, suggested }
  }

  // Fetch current lead state
  const { data: existingLead } = await admin
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle()

  if (!existingLead) return { autoUpdated, suggested }

  const updates: Record<string, unknown> = {}

  for (const [field, value] of Object.entries(extraction.lead_updates)) {
    if (value === null || value === undefined) continue

    // Skip sensitive fields — always suggest
    if (SENSITIVE_FIELDS.includes(field)) {
      suggested.push(field)
      continue
    }

    // Only process known auto-update fields
    if (!AUTO_UPDATE_FIELDS.includes(field)) continue

    // Skip if value hasn't changed
    if (JSON.stringify(existingLead[field]) === JSON.stringify(value)) continue

    if (extraction.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
      updates[field] = value
      autoUpdated.push(field)
    } else {
      suggested.push(field)
    }
  }

  // Apply auto-updates
  if (Object.keys(updates).length > 0) {
    await admin
      .from("leads")
      .update(updates)
      .eq("id", leadId)

    // Build before/after for audit
    const before: Record<string, unknown> = {}
    const after: Record<string, unknown> = {}
    for (const field of autoUpdated) {
      before[field] = existingLead[field]
      after[field] = updates[field]
    }

    await logAudit({
      orgId,
      actorId: employeeId,
      entity: "lead",
      entityId: leadId,
      action: "ai_update",
      before,
      after,
      source: "ai",
      modelVersion: "deepseek-chat",
      confidence: extraction.confidence,
    })
  }

  // Create suggestion activity for low-confidence or sensitive fields
  if (suggested.length > 0) {
    const suggestionDetails = suggested
      .map((field) => `${field}: ${JSON.stringify(extraction.lead_updates[field])}`)
      .join(", ")

    await admin.from("lead_activities").insert({
      lead_id: leadId,
      actor_id: employeeId,
      type: "ai_update",
      body: `AI Suggestion (confidence: ${extraction.confidence}): ${suggestionDetails}`,
    })
  }

  // Update temperature based on intent signal
  const intent = extraction.signals?.intent as string | undefined
  if (intent && extraction.confidence >= HIGH_CONFIDENCE_THRESHOLD) {
    const temperatureMap: Record<string, string> = {
      high: "hot",
      medium: "warm",
      low: "cold",
      none: "cold",
    }
    const newTemp = temperatureMap[intent]
    if (newTemp && newTemp !== existingLead.temperature) {
      await admin
        .from("leads")
        .update({ temperature: newTemp })
        .eq("id", leadId)

      await logAudit({
        orgId,
        entity: "lead",
        entityId: leadId,
        action: "ai_update",
        before: { temperature: existingLead.temperature },
        after: { temperature: newTemp },
        source: "ai",
        confidence: extraction.confidence,
      })
    }
  }

  // Merge into ai_buyer_profile (accumulative)
  await mergeIntoBuyerProfile(admin, leadId, extraction)

  return { autoUpdated, suggested }
}

/**
 * Merge extraction results into leads.ai_buyer_profile JSONB.
 * Each fact has provenance: source, confidence, timestamp, status.
 */
async function mergeIntoBuyerProfile(
  admin: ReturnType<typeof getSupabaseAdmin>,
  leadId: string,
  extraction: ExtractionResult
) {
  const { data: lead } = await admin
    .from("leads")
    .select("ai_buyer_profile")
    .eq("id", leadId)
    .maybeSingle()

  const existing = (lead?.ai_buyer_profile || {}) as Record<string, unknown>
  const now = new Date().toISOString()

  // Merge requirements
  const requirements = (existing.requirements || {}) as Record<string, unknown>
  for (const [field, value] of Object.entries(extraction.lead_updates || {})) {
    if (value !== null && value !== undefined) {
      requirements[field] = {
        value,
        confidence: extraction.confidence,
        updated_at: now,
        status: extraction.confidence >= HIGH_CONFIDENCE_THRESHOLD ? "ai_inferred" : "ai_suggested",
      }
    }
  }

  // Merge projects discussed
  const existingProjects = (existing.projects_discussed || []) as Record<string, unknown>[]
  const newProjects = (extraction.signals?.projects_discussed || []) as {
    name: string
    sentiment: string
  }[]
  for (const proj of newProjects) {
    const existingIdx = existingProjects.findIndex(
      (p) => (p.name as string)?.toLowerCase() === proj.name.toLowerCase()
    )
    if (existingIdx >= 0) {
      existingProjects[existingIdx] = { ...existingProjects[existingIdx], ...proj, updated_at: now }
    } else {
      existingProjects.push({ ...proj, updated_at: now })
    }
  }

  // Merge objections
  const existingObjections = (existing.objections || []) as string[]
  const newObjections = (extraction.signals?.objections || []) as string[]
  const mergedObjections = [...new Set([...existingObjections, ...newObjections])]

  // Merge promises
  const existingPromises = (existing.promises || {}) as Record<string, string[]>
  const newPromises = extraction.promises || { by_rep: [], by_customer: [] }

  const updatedProfile = {
    ...existing,
    requirements,
    projects_discussed: existingProjects,
    objections: mergedObjections,
    promises: {
      by_rep: [...new Set([...(existingPromises.by_rep || []), ...(newPromises.by_rep || [])])],
      by_customer: [...new Set([...(existingPromises.by_customer || []), ...(newPromises.by_customer || [])])],
    },
    last_updated: now,
  }

  await admin
    .from("leads")
    .update({ ai_buyer_profile: updatedProfile })
    .eq("id", leadId)
}
