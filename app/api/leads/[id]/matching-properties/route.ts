import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/leads/[id]/matching-properties
 * Query fs_units against the lead's ai_buyer_profile + explicit fields.
 * Returns ranked matches with reasons.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: leadId } = await params
  const admin = getSupabaseAdmin()

  // Fetch lead with buyer profile
  const { data: lead } = await admin
    .from("leads")
    .select(
      "id, budget_min, budget_max, configuration, preferred_locations, " +
      "purpose, ai_buyer_profile, city, project"
    )
    .eq("id", leadId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  // Build search criteria from lead fields + AI profile
  const profile = (lead.ai_buyer_profile || {}) as Record<string, unknown>
  const requirements = (profile.requirements || {}) as Record<string, { value: unknown }>

  const budgetMin = lead.budget_min || (requirements.budget_min?.value as number) || null
  const budgetMax = lead.budget_max || (requirements.budget_max?.value as number) || null
  const configuration = lead.configuration || (requirements.configuration?.value as string) || null
  const locations = lead.preferred_locations?.length
    ? lead.preferred_locations
    : (requirements.locations?.value as string[]) || []

  // Query available units
  let query = admin
    .from("fs_units")
    .select("*, project:fs_projects!fs_units_project_id_fkey(id, name, location, city, builder)")
    .eq("org_id", caller.orgId)
    .eq("status", "available")
    .order("price", { ascending: true })
    .limit(20)

  // Hard constraints
  if (budgetMax) query = query.lte("price", budgetMax * 1.1) // 10% tolerance
  if (budgetMin) query = query.gte("price", budgetMin * 0.9)
  if (configuration) query = query.eq("configuration", configuration)

  const { data: units, error } = await query

  if (error) {
    console.error("matching properties query error:", error)
    return NextResponse.json({ error: "Failed to fetch properties" }, { status: 500 })
  }

  // Score and rank matches
  const scored = (units || []).map((unit) => {
    const reasons: string[] = []
    let score = 0

    // Budget fit
    const price = Number(unit.price || 0)
    if (budgetMax && price <= budgetMax) {
      score += 3
      reasons.push("Within budget")
    } else if (budgetMax && price <= budgetMax * 1.1) {
      score += 1
      reasons.push("Slightly above budget (within 10%)")
    }

    // Configuration match
    if (configuration && unit.configuration === configuration) {
      score += 3
      reasons.push(`Matches ${configuration} requirement`)
    }

    // Location match
    const projectCity = (unit.project as Record<string, unknown>)?.city as string
    const projectLocation = (unit.project as Record<string, unknown>)?.location as string
    if (locations.length > 0) {
      const locMatch = locations.some(
        (loc: string) =>
          projectCity?.toLowerCase().includes(loc.toLowerCase()) ||
          projectLocation?.toLowerCase().includes(loc.toLowerCase())
      )
      if (locMatch) {
        score += 2
        reasons.push("Preferred location match")
      }
    }

    // Project interest (from AI profile)
    const projectName = (unit.project as Record<string, unknown>)?.name as string
    const projectsDiscussed = (profile.projects_discussed || []) as {
      name: string
      sentiment: string
    }[]
    const discussed = projectsDiscussed.find(
      (p) => projectName?.toLowerCase().includes(p.name.toLowerCase())
    )
    if (discussed?.sentiment === "positive") {
      score += 2
      reasons.push("Previously discussed with positive sentiment")
    } else if (discussed?.sentiment === "rejected") {
      score -= 3
      reasons.push("Previously rejected")
    }

    return {
      unit_id: unit.id,
      project_name: projectName || "Unknown",
      configuration: unit.configuration,
      price: unit.price,
      floor: unit.floor,
      area_sqft: unit.area_sqft,
      status: unit.status,
      project: unit.project,
      match_score: score,
      reasons,
    }
  })

  // Sort by score descending, filter out rejected
  const ranked = scored
    .filter((s) => s.match_score > 0)
    .sort((a, b) => b.match_score - a.match_score)

  return NextResponse.json({
    matches: ranked,
    search_criteria: {
      budget_min: budgetMin,
      budget_max: budgetMax,
      configuration,
      locations,
    },
    total: ranked.length,
  })
}
