import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Round-robin lead assignment.
 * Finds a matching active assignment rule by source filter,
 * resolves the pool (subtree or all setters), assigns to the
 * next setter in rotation, and bumps the cursor.
 */
export async function assignLead(
  admin: SupabaseClient,
  leadId: string,
  orgId: string,
  source: string
): Promise<string | null> {
  // Find matching active rule for this org/source
  const { data: rules } = await admin
    .from("assignment_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  if (!rules || rules.length === 0) return null

  // Find first rule whose source_filter matches (empty = match all)
  const rule = rules.find((r) => {
    const filters = r.source_filter as string[]
    return !filters || filters.length === 0 || filters.includes(source)
  })

  if (!rule) return null

  // Resolve the pool of setters
  let pool: { id: string }[] = []

  if (rule.pool_root_id) {
    // Subtree pool: get all setters in the subtree
    const { data: subtreeMembers } = await admin.rpc("subtree_ids", {
      p_root: rule.pool_root_id,
    })

    if (subtreeMembers && subtreeMembers.length > 0) {
      const subtreeIds = subtreeMembers.map(
        (m: { id: string }) => m.id
      )
      const { data: setters } = await admin
        .from("fs_employees")
        .select("id")
        .in("id", subtreeIds)
        .eq("role", "setter")
        .eq("is_active", true)
        .order("full_name")

      pool = setters || []
    }
  } else {
    // All setters in the org
    const { data: setters } = await admin
      .from("fs_employees")
      .select("id")
      .eq("org_id", orgId)
      .eq("role", "setter")
      .eq("is_active", true)
      .order("full_name")

    pool = setters || []
  }

  if (pool.length === 0) return null

  // Round-robin: pick next setter
  const nextIdx = ((rule.last_assigned_idx || 0) + 1) % pool.length
  const assignee = pool[nextIdx]

  // Assign the lead
  await admin
    .from("leads")
    .update({ assigned_to: assignee.id })
    .eq("id", leadId)

  // Bump cursor
  await admin
    .from("assignment_rules")
    .update({ last_assigned_idx: nextIdx })
    .eq("id", rule.id)

  return assignee.id
}
