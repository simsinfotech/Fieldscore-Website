import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/** GET /api/org/invite — admin only: the org's current invite token. */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from("fs_organizations")
    .select("invite_token")
    .eq("id", caller.orgId)
    .single()

  return NextResponse.json({ token: data?.invite_token ?? null })
}

/** POST /api/org/invite — admin only: rotate the invite token. */
export async function POST() {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!caller.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const admin = getSupabaseAdmin()
  const newToken = crypto.randomUUID().replace(/-/g, "")
  const { error } = await admin
    .from("fs_organizations")
    .update({ invite_token: newToken })
    .eq("id", caller.orgId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ token: newToken })
}
