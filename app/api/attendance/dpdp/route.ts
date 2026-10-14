import { NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

// Bump this when the notice text changes to re-prompt everyone.
const DPDP_POLICY_VERSION = "v1"

/** GET — whether the caller has acknowledged the current policy version. */
export async function GET() {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { data } = await admin
    .from("dpdp_acknowledgements")
    .select("acknowledged_at")
    .eq("employee_id", caller.employeeId)
    .eq("policy_version", DPDP_POLICY_VERSION)
    .maybeSingle()

  return NextResponse.json({ acknowledged: !!data, version: DPDP_POLICY_VERSION })
}

/** POST — record the caller's acknowledgement (idempotent). */
export async function POST() {
  const caller = await resolveEmployee()
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from("dpdp_acknowledgements")
    .upsert(
      { employee_id: caller.employeeId, policy_version: DPDP_POLICY_VERSION },
      { onConflict: "employee_id,policy_version", ignoreDuplicates: true }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ acknowledged: true })
}
