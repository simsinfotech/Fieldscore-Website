import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { syncSheet } from "@/lib/leads/sheet-sync"
import type { LeadSourceSheet } from "@/types"

/**
 * POST /api/leads/sheet-sync
 * Cron endpoint — syncs all active sheet sources that are due for polling.
 * Secured via CRON_SECRET header.
 */
export async function POST(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  // Fetch all active sources due for sync
  const { data: sources, error } = await admin
    .from("lead_source_sheets")
    .select("*")
    .eq("is_active", true)

  if (error || !sources) {
    return NextResponse.json(
      { error: "Failed to fetch sources" },
      { status: 500 }
    )
  }

  const now = Date.now()
  const results: Record<string, { synced: number; errors: number; skipped: number }> = {}

  for (const source of sources as unknown as LeadSourceSheet[]) {
    // Check if enough time has passed since last sync
    if (source.last_synced_at) {
      const elapsed = now - new Date(source.last_synced_at).getTime()
      const intervalMs = (source.poll_interval_m || 5) * 60 * 1000
      if (elapsed < intervalMs) continue
    }

    const result = await syncSheet(admin, source)
    results[source.id] = result
  }

  return NextResponse.json({ success: true, results })
}
