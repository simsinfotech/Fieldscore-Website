import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

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

    // Verify the caller is an admin or sales_admin
    const { data: caller } = await supabase
      .from("fs_employees")
      .select("is_admin, org_id, role")
      .eq("auth_id", user.id)
      .single()

    if (!caller?.is_admin && caller?.role !== "sales_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      full_name,
      email,
      password,
      designation,
      department,
      phone,
      org_id,
      is_admin,
      role,
      reports_to,
    } = body

    if (!full_name || !email || !password || !designation || !org_id) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Verify the caller belongs to the same org
    if (caller.org_id !== org_id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const supabaseAdmin = getSupabaseAdmin()

    // Create the auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })

    if (authError) {
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    // Determine role — use explicit role if provided, else derive from is_admin
    const employeeRole = role || (is_admin ? "admin" : "viewer")

    // Insert employee record
    const { data: employee, error: empError } = await supabaseAdmin
      .from("fs_employees")
      .insert({
        auth_id: authData.user.id,
        org_id,
        full_name,
        email,
        designation,
        department: department || null,
        phone: phone || null,
        is_admin: is_admin ?? false,
        is_active: true,
        date_of_joining: new Date().toISOString().split("T")[0],
        role: employeeRole,
        reports_to: reports_to || null,
      })
      .select()
      .single()

    if (empError) {
      // Clean up: delete the auth user if employee insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return NextResponse.json(
        { error: empError.message },
        { status: 500 }
      )
    }

    // Create leave balances for the current year
    const currentYear = new Date().getFullYear()
    await supabaseAdmin.from("fs_leave_balances").insert({
      employee_id: employee.id,
      year: currentYear,
      casual_total: 12,
      casual_used: 0,
      sick_total: 6,
      sick_used: 0,
      earned_total: 15,
      earned_used: 0,
    })

    return NextResponse.json({ employee }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
