import { getSupabaseAdmin } from "@/lib/supabase/admin"

interface AuditLogInput {
  orgId: string
  actorId?: string
  entity: string          // 'lead', 'call_log', 'task', 'contact', 'opportunity', etc.
  entityId: string
  action: string          // 'create', 'update', 'delete', 'ai_update'
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  source?: string         // 'manual', 'ai', 'system', 'webhook'
  modelVersion?: string
  confidence?: number
}

/**
 * Insert an audit event into audit_events table.
 * Fire-and-forget — errors are logged but never thrown to the caller.
 */
export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    const admin = getSupabaseAdmin()
    await admin.from("audit_events").insert({
      org_id: input.orgId,
      actor_id: input.actorId || null,
      entity: input.entity,
      entity_id: input.entityId,
      action: input.action,
      before: input.before || null,
      after: input.after || null,
      source: input.source || "manual",
      model_version: input.modelVersion || null,
      confidence: input.confidence ?? null,
    })
  } catch (err) {
    console.error("audit: failed to log event", err)
  }
}

/**
 * Compute a diff between two objects, returning only changed fields.
 * Useful for building the `before` / `after` JSONB in audit_events.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[]
): { before: Record<string, unknown>; after: Record<string, unknown> } | null {
  const b: Record<string, unknown> = {}
  const a: Record<string, unknown> = {}
  let hasChanges = false

  for (const f of fields) {
    if (JSON.stringify(before[f]) !== JSON.stringify(after[f])) {
      b[f] = before[f]
      a[f] = after[f]
      hasChanges = true
    }
  }

  return hasChanges ? { before: b, after: a } : null
}
