import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Distribute a manager's pending-approval leads evenly across the active
 * setters in their subtree (batch-local round-robin: lead[i] → setter[i % k]).
 *
 * Idempotent + dedup-safe: only touches leads still in `pending_approval`
 * for this manager, so re-running never re-assigns an already-assigned lead.
 */
export async function distributeToSetters(
  admin: SupabaseClient,
  managerId: string,
  orgId: string,
  leadIds?: string[]
): Promise<{ distributed: number; setters: number }> {
  // Setters within the manager's subtree
  const { data: subtree } = await admin.rpc("subtree_ids", { p_root: managerId })
  const ids = (subtree ?? []).map((s: { id: string }) => s.id)
  if (ids.length === 0) return { distributed: 0, setters: 0 }

  const { data: setters } = await admin
    .from("fs_employees")
    .select("id")
    .in("id", ids)
    .eq("role", "setter")
    .eq("is_active", true)
    .order("full_name")

  const pool = (setters ?? []).map((s) => s.id)
  if (pool.length === 0) return { distributed: 0, setters: 0 }

  // This manager's pending leads (optionally a specific subset)
  let q = admin
    .from("leads")
    .select("id")
    .eq("org_id", orgId)
    .eq("assignment_state", "pending_approval")
    .eq("pending_manager_id", managerId)
    .order("created_at", { ascending: true })
  if (leadIds && leadIds.length) q = q.in("id", leadIds)

  const { data: pending } = await q
  const leads = pending ?? []

  let distributed = 0
  for (let i = 0; i < leads.length; i++) {
    const setterId = pool[i % pool.length]
    const { error } = await admin
      .from("leads")
      .update({
        assigned_to: setterId,
        assignment_state: "assigned",
        pending_manager_id: null,
      })
      .eq("id", leads[i].id)
      .eq("assignment_state", "pending_approval") // guard against races / double-run
    if (!error) distributed++
  }

  return { distributed, setters: pool.length }
}
