import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * POST /api/join  (public — gated by a valid org invite token)
 * The employee self-registers with email + password. We provision their
 * account server-side (email pre-confirmed, no SMTP needed) and link it to
 * the org as a default 'viewer'. The admin then assigns role/department.
 *
 * The client never receives admin credentials; the admin only shares the
 * /join?token=... link.
 */
export async function POST(request: NextRequest) {
  const { token, full_name, email, password } = await request.json()

  if (!token || !full_name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 })
  }
  const emailNorm = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return NextResponse.json({ error: "Enter a valid email" }, { status: 400 })
  }

  const admin = getSupabaseAdmin()

  // Resolve the workspace from the invite token
  const { data: org } = await admin
    .from("fs_organizations")
    .select("id, name")
    .eq("invite_token", token)
    .maybeSingle()

  if (!org) {
    return NextResponse.json({ error: "This invite link is invalid or has been revoked" }, { status: 400 })
  }

  // Is there already an employee row for this email in the org?
  const { data: existingRows } = await admin
    .from("fs_employees")
    .select("id, auth_id, is_active")
    .eq("org_id", org.id)
    .ilike("email", emailNorm)

  const alreadyOnboarded = (existingRows ?? []).find((r) => r.auth_id)
  if (alreadyOnboarded) {
    return NextResponse.json(
      { error: "This email already has an account. Please log in instead." },
      { status: 409 }
    )
  }

  // Create the auth user (email pre-confirmed so they can log in immediately)
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: emailNorm,
    password,
    email_confirm: true,
  })
  if (authError || !authData?.user) {
    // Most common: the email already has an auth account in another context.
    return NextResponse.json(
      { error: authError?.message?.includes("already") ? "This email already has an account. Please log in." : (authError?.message || "Could not create account") },
      { status: 400 }
    )
  }

  const authId = authData.user.id
  const pending = (existingRows ?? []).find((r) => !r.auth_id)
  let employeeId: string

  if (pending) {
    // Link a directory-only / pending row (also self-heals seeded records)
    const { data: linked, error } = await admin
      .from("fs_employees")
      .update({ auth_id: authId, full_name: full_name.trim(), is_active: true })
      .eq("id", pending.id)
      .select("id")
      .single()
    if (error) {
      await admin.auth.admin.deleteUser(authId)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    employeeId = linked.id
  } else {
    const { data: created, error } = await admin
      .from("fs_employees")
      .insert({
        auth_id: authId,
        org_id: org.id,
        full_name: full_name.trim(),
        email: emailNorm,
        designation: "Member",
        role: "viewer",
        scope: "own",
        is_active: true,
        date_of_joining: new Date().toISOString().split("T")[0],
      })
      .select("id")
      .single()
    if (error) {
      await admin.auth.admin.deleteUser(authId)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    employeeId = created.id
  }

  // Leave balances for the current year (parity with admin-create flow)
  await admin.from("fs_leave_balances").upsert(
    { employee_id: employeeId, year: new Date().getFullYear() },
    { onConflict: "employee_id,year", ignoreDuplicates: true }
  )

  return NextResponse.json({ success: true, org: org.name, email: emailNorm })
}
