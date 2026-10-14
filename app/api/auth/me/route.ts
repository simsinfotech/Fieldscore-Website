import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ user: null, employee: null })
  }

  const { data: employee } = await supabase
    .from("fs_employees")
    .select("*")
    .eq("auth_id", user.id)
    .eq("is_active", true)
    .maybeSingle()

  if (!employee) {
    // No active employee record — sign out and treat as unauthenticated
    await supabase.auth.signOut()
    return NextResponse.json({ user: null, employee: null }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    })
  }

  return NextResponse.json({ user, employee }, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  })
}
