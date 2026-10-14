import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/push-token
 * Saves the Expo push token for the authenticated employee.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const token = body.token

  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid token" },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from("fs_employees")
    .update({ expo_push_token: token })
    .eq("auth_id", user.id)

  if (error) {
    return NextResponse.json(
      { error: "Failed to save token" },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}
