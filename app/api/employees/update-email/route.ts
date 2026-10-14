import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { resolveAuthId } from "@/lib/supabase/resolve-auth-id"

export async function POST(request: NextRequest) {
  try {
    // Authenticate the caller
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify the caller is an admin
    const { data: caller } = await supabase
      .from("fs_employees")
      .select("is_admin, org_id")
      .eq("auth_id", user.id)
      .single()

    if (!caller?.is_admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { employee_id, email } = await request.json()

    if (!employee_id || !email) {
      return NextResponse.json(
        { error: "Missing employee_id or email" },
        { status: 400 }
      )
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Fetch the target employee and verify same org
    const { data: target, error: targetError } = await supabaseAdmin
      .from("fs_employees")
      .select("auth_id, org_id, email")
      .eq("id", employee_id)
      .single()

    if (targetError || !target) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      )
    }

    if (target.org_id !== caller.org_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // No-op if the email hasn't changed
    if (target.email === email) {
      return NextResponse.json({ success: true, unchanged: true })
    }

    // Resolve a valid auth_id (stored one may be missing or invalid).
    // Pass the current DB email as the hint so we can find the auth user
    // even when the fs_employees record has a typo.
    const authId = await resolveAuthId(supabaseAdmin, target, email)

    if (!authId) {
      return NextResponse.json(
        {
          error:
            "Could not find a matching auth user for this employee. Check the email in Supabase Authentication.",
        },
        { status: 404 }
      )
    }

    // Backfill the auth_id if it was missing/invalid
    if (target.auth_id !== authId) {
      await supabaseAdmin
        .from("fs_employees")
        .update({ auth_id: authId })
        .eq("id", employee_id)
    }

    // Update the auth user's email (auto-confirm to skip email verification step)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      authId,
      {
        email,
        email_confirm: true,
      }
    )

    if (authError) {
      return NextResponse.json(
        { error: "Auth update failed: " + authError.message },
        { status: 400 }
      )
    }

    // Update the fs_employees record
    const { error: empError } = await supabaseAdmin
      .from("fs_employees")
      .update({ email })
      .eq("id", employee_id)

    if (empError) {
      return NextResponse.json(
        { error: "Employee update failed: " + empError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[update-email] error:", message)
    return NextResponse.json(
      { error: `Update email failed: ${message}` },
      { status: 500 }
    )
  }
}
