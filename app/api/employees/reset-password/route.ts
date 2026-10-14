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

    const { employee_id, password, email_hint } = await request.json()

    if (!employee_id || !password) {
      return NextResponse.json(
        { error: "Missing employee_id or password" },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      )
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Fetch the target employee and verify same org
    const { data: target, error: targetError } = await supabaseAdmin
      .from("fs_employees")
      .select("auth_id, org_id, full_name, email")
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

    // Resolve a valid auth_id (the stored one may be missing or invalid)
    const authId = await resolveAuthId(supabaseAdmin, target, email_hint)

    if (!authId) {
      return NextResponse.json(
        {
          error:
            "Could not find a matching auth user for this employee. Make sure the employee's email matches a user in Supabase Authentication.",
        },
        { status: 404 }
      )
    }

    // If the stored auth_id was missing/invalid, backfill it for next time
    if (target.auth_id !== authId) {
      await supabaseAdmin
        .from("fs_employees")
        .update({ auth_id: authId })
        .eq("id", employee_id)
    }

    // Update the auth user's password and ensure email is confirmed
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      authId,
      {
        password,
        email_confirm: true,
      }
    )

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, full_name: target.full_name })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[reset-password] error:", message)
    return NextResponse.json(
      { error: `Reset password failed: ${message}` },
      { status: 500 }
    )
  }
}
