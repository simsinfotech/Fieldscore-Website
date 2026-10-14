import type { SupabaseClient } from "@supabase/supabase-js"

type Strategy =
  | "round_robin"
  | "weighted"
  | "location"
  | "source"
  | "budget"
  | "availability"
  | "sla_reassign"

interface AssignmentRule {
  id: string
  org_id: string
  strategy: Strategy
  source_filter: string[] | null
  pool_root_id: string | null
  last_assigned_idx: number
  config: Record<string, unknown> | null
  is_active: boolean
}

interface PoolMember {
  id: string
  full_name: string
  role: string
}

interface LeadRow {
  id: string
  source: string
  city: string | null
  budget_max: number | null
  assigned_to: string | null
}

/**
 * Resolve the pool of eligible setters for a rule.
 * If pool_root_id is set, only setters in that manager's subtree.
 * Otherwise all setters in the org.
 */
async function resolvePool(
  admin: SupabaseClient,
  orgId: string,
  poolRootId: string | null
): Promise<PoolMember[]> {
  if (poolRootId) {
    const { data: subtree } = await admin.rpc("subtree_ids", { p_root: poolRootId })
    if (!subtree || subtree.length === 0) return []

    const ids = subtree.map((m: { id: string }) => m.id)
    const { data } = await admin
      .from("fs_employees")
      .select("id, full_name, role")
      .in("id", ids)
      .eq("role", "setter")
      .eq("is_active", true)
      .order("full_name")

    return data || []
  }

  const { data } = await admin
    .from("fs_employees")
    .select("id, full_name, role")
    .eq("org_id", orgId)
    .eq("role", "setter")
    .eq("is_active", true)
    .order("full_name")

  return data || []
}

/** Classic round-robin: rotate through pool sequentially. */
async function roundRobin(
  pool: PoolMember[],
  rule: AssignmentRule
): Promise<{ assigneeId: string; nextIdx: number }> {
  const nextIdx = ((rule.last_assigned_idx || 0) + 1) % pool.length
  return { assigneeId: pool[nextIdx].id, nextIdx }
}

/** Weighted: pick the setter with the fewest active leads. */
async function weighted(
  admin: SupabaseClient,
  pool: PoolMember[],
  orgId: string
): Promise<{ assigneeId: string; nextIdx: number }> {
  const ids = pool.map((p) => p.id)

  const { data: counts } = await admin
    .from("leads")
    .select("assigned_to")
    .eq("org_id", orgId)
    .in("assigned_to", ids)
    .not("status", "in", '("won","lost","junk")')

  const countMap = new Map<string, number>()
  for (const id of ids) countMap.set(id, 0)
  for (const row of counts || []) {
    if (row.assigned_to) {
      countMap.set(row.assigned_to, (countMap.get(row.assigned_to) || 0) + 1)
    }
  }

  let minCount = Infinity
  let bestId = pool[0].id
  let bestIdx = 0

  for (let i = 0; i < pool.length; i++) {
    const c = countMap.get(pool[i].id) || 0
    if (c < minCount) {
      minCount = c
      bestId = pool[i].id
      bestIdx = i
    }
  }

  return { assigneeId: bestId, nextIdx: bestIdx }
}

/** Location: match lead's city to employee's assigned locations in rule config. */
async function locationBased(
  admin: SupabaseClient,
  pool: PoolMember[],
  lead: LeadRow,
  rule: AssignmentRule,
  orgId: string
): Promise<{ assigneeId: string; nextIdx: number }> {
  const locationMap = (rule.config?.location_assignments || {}) as Record<string, string[]>

  if (lead.city) {
    const cityLower = lead.city.toLowerCase()
    for (let i = 0; i < pool.length; i++) {
      const assignedLocations = locationMap[pool[i].id] || []
      if (assignedLocations.some((loc: string) => loc.toLowerCase() === cityLower)) {
        return { assigneeId: pool[i].id, nextIdx: i }
      }
    }
  }

  // Fallback to weighted if no location match
  return weighted(admin, pool, orgId)
}

/** Source: different pools per lead source, configured in rule.config.source_pools. */
async function sourceBased(
  admin: SupabaseClient,
  pool: PoolMember[],
  lead: LeadRow,
  rule: AssignmentRule,
  orgId: string
): Promise<{ assigneeId: string; nextIdx: number }> {
  const sourcePools = (rule.config?.source_pools || {}) as Record<string, string[]>
  const sourcePool = sourcePools[lead.source]

  if (sourcePool && sourcePool.length > 0) {
    const filtered = pool.filter((p) => sourcePool.includes(p.id))
    if (filtered.length > 0) {
      return weighted(admin, filtered, orgId)
    }
  }

  // Fallback to round-robin on full pool
  return roundRobin(pool, rule)
}

/** Budget: route high-value leads to senior reps. config.budget_tiers defines thresholds. */
async function budgetBased(
  admin: SupabaseClient,
  pool: PoolMember[],
  lead: LeadRow,
  rule: AssignmentRule,
  orgId: string
): Promise<{ assigneeId: string; nextIdx: number }> {
  const tiers = (rule.config?.budget_tiers || []) as {
    min: number
    assignees: string[]
  }[]

  if (lead.budget_max && tiers.length > 0) {
    // Sort tiers descending so highest threshold matches first
    const sorted = [...tiers].sort((a, b) => b.min - a.min)
    for (const tier of sorted) {
      if (lead.budget_max >= tier.min) {
        const filtered = pool.filter((p) => tier.assignees.includes(p.id))
        if (filtered.length > 0) {
          return weighted(admin, filtered, orgId)
        }
      }
    }
  }

  return weighted(admin, pool, orgId)
}

/** Availability: skip checked-out employees (no active attendance session today). */
async function availabilityBased(
  admin: SupabaseClient,
  pool: PoolMember[],
  rule: AssignmentRule,
  orgId: string
): Promise<{ assigneeId: string; nextIdx: number }> {
  const today = new Date().toISOString().split("T")[0]
  const ids = pool.map((p) => p.id)

  const { data: sessions } = await admin
    .from("fs_attendance")
    .select("employee_id")
    .in("employee_id", ids)
    .eq("date", today)
    .not("check_in", "is", null)

  const checkedInIds = new Set((sessions || []).map((s: { employee_id: string }) => s.employee_id))
  const available = pool.filter((p) => checkedInIds.has(p.id))

  if (available.length > 0) {
    return weighted(admin, available, orgId)
  }

  // No one checked in — fall back to full pool round-robin
  return roundRobin(pool, rule)
}

/** SLA reassign: reassign if current owner hasn't touched the lead in X hours. */
async function slaReassign(
  admin: SupabaseClient,
  pool: PoolMember[],
  lead: LeadRow,
  rule: AssignmentRule,
  orgId: string
): Promise<{ assigneeId: string; nextIdx: number } | null> {
  const slaHours = (rule.config?.sla_hours as number) || 24

  if (!lead.assigned_to) {
    return weighted(admin, pool, orgId)
  }

  // Check last activity on this lead
  const { data: lastActivity } = await admin
    .from("lead_activities")
    .select("created_at")
    .eq("lead_id", lead.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastTouchTime = lastActivity?.created_at
    ? new Date(lastActivity.created_at).getTime()
    : 0
  const hoursElapsed = (Date.now() - lastTouchTime) / (1000 * 60 * 60)

  if (hoursElapsed < slaHours) {
    return null // SLA not breached, don't reassign
  }

  // Reassign to someone else in the pool
  const others = pool.filter((p) => p.id !== lead.assigned_to)
  if (others.length === 0) return null

  return weighted(admin, others, orgId)
}

/**
 * Allocate a lead using the strategy defined in the matching assignment rule.
 * Extends the original assignLead() with 7 additional strategies.
 */
export async function allocateLead(
  admin: SupabaseClient,
  leadId: string,
  orgId: string,
  source: string
): Promise<string | null> {
  // 1. Fetch the lead
  const { data: lead } = await admin
    .from("leads")
    .select("id, source, city, budget_max, assigned_to")
    .eq("id", leadId)
    .maybeSingle()

  if (!lead) return null

  // 2. Find matching active rule
  const { data: rules } = await admin
    .from("assignment_rules")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })

  // If no rules exist, fall back to simple round-robin across all active
  // non-admin employees — no setup required.
  if (!rules || rules.length === 0) {
    return autoRoundRobin(admin, leadId, orgId)
  }

  const rule = rules.find((r) => {
    const filters = r.source_filter as string[] | null
    return !filters || filters.length === 0 || filters.includes(source)
  }) as AssignmentRule | undefined

  if (!rule) {
    return autoRoundRobin(admin, leadId, orgId)
  }

  // 3. Resolve pool
  const pool = await resolvePool(admin, orgId, rule.pool_root_id)
  if (pool.length === 0) {
    // Pool empty (no setters) — fall back to all active employees
    return autoRoundRobin(admin, leadId, orgId)
  }

  // 4. Dispatch to strategy
  const strategy = (rule.strategy || "round_robin") as Strategy
  let result: { assigneeId: string; nextIdx: number } | null = null

  switch (strategy) {
    case "round_robin":
      result = await roundRobin(pool, rule)
      break
    case "weighted":
      result = await weighted(admin, pool, orgId)
      break
    case "location":
      result = await locationBased(admin, pool, lead as LeadRow, rule, orgId)
      break
    case "source":
      result = await sourceBased(admin, pool, lead as LeadRow, rule, orgId)
      break
    case "budget":
      result = await budgetBased(admin, pool, lead as LeadRow, rule, orgId)
      break
    case "availability":
      result = await availabilityBased(admin, pool, rule, orgId)
      break
    case "sla_reassign":
      result = await slaReassign(admin, pool, lead as LeadRow, rule, orgId)
      break
    default:
      result = await roundRobin(pool, rule)
  }

  if (!result) return null

  // 5. Assign + bump cursor
  await admin
    .from("leads")
    .update({ assigned_to: result.assigneeId, assignment_state: "assigned" })
    .eq("id", leadId)

  await admin
    .from("assignment_rules")
    .update({ last_assigned_idx: result.nextIdx })
    .eq("id", rule.id)

  return result.assigneeId
}

/**
 * Simple auto round-robin when no assignment rules are configured.
 * Picks the next active employee (non-admin, non-viewer) using a
 * cursor stored in org_settings or a simple modulo on employee count.
 */
async function autoRoundRobin(
  admin: SupabaseClient,
  leadId: string,
  orgId: string
): Promise<string | null> {
  // Get all active employees who can receive leads (setter, manager, sales_admin)
  const { data: employees } = await admin
    .from("fs_employees")
    .select("id, full_name, role")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .in("role", ["setter", "manager", "sales_admin"])
    .order("full_name")

  if (!employees || employees.length === 0) return null

  // Get the last assignment cursor for this org from a simple counter
  // We use the leads table itself to determine who got the last lead
  const { data: lastAssigned } = await admin
    .from("leads")
    .select("assigned_to")
    .eq("org_id", orgId)
    .not("assigned_to", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  let nextIdx = 0
  if (lastAssigned?.assigned_to) {
    const lastIdx = employees.findIndex((e) => e.id === lastAssigned.assigned_to)
    nextIdx = lastIdx >= 0 ? (lastIdx + 1) % employees.length : 0
  }

  const assignee = employees[nextIdx]

  await admin
    .from("leads")
    .update({ assigned_to: assignee.id, assignment_state: "assigned" })
    .eq("id", leadId)

  return assignee.id
}
