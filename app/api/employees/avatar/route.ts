import { createClient } from "@/lib/supabase/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE = 2 * 1024 * 1024 // 2 MB

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: employee } = await supabase
    .from("fs_employees")
    .select("id")
    .eq("auth_id", user.id)
    .single()

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Only JPG, PNG, and WebP are allowed." },
      { status: 400 }
    )
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 2 MB." },
      { status: 400 }
    )
  }

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1]
  const filePath = `${employee.id}_${Date.now()}.${ext}`

  const admin = getSupabaseAdmin()

  // Remove any existing avatar files for this employee
  const { data: existing } = await admin.storage.from("avatars").list("", {
    search: employee.id,
  })
  if (existing && existing.length > 0) {
    const toRemove = existing
      .filter((f) => f.name.startsWith(employee.id))
      .map((f) => f.name)
    if (toRemove.length > 0) {
      await admin.storage.from("avatars").remove(toRemove)
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await admin.storage
    .from("avatars")
    .upload(filePath, buffer, {
      contentType: file.type,
      cacheControl: "0",
      upsert: true,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: "Upload failed: " + uploadError.message },
      { status: 500 }
    )
  }

  const {
    data: { publicUrl },
  } = admin.storage.from("avatars").getPublicUrl(filePath)

  // Append cache-buster so browsers pick up the new image
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await admin
    .from("fs_employees")
    .update({ avatar_url: avatarUrl })
    .eq("id", employee.id)

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }

  return NextResponse.json({ avatar_url: avatarUrl })
}

export async function DELETE() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: employee } = await supabase
    .from("fs_employees")
    .select("id")
    .eq("auth_id", user.id)
    .single()

  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 })
  }

  const admin = getSupabaseAdmin()

  // Remove all avatar files for this employee
  const { data: existing } = await admin.storage.from("avatars").list("", {
    search: employee.id,
  })
  if (existing && existing.length > 0) {
    const toRemove = existing
      .filter((f) => f.name.startsWith(employee.id))
      .map((f) => f.name)
    if (toRemove.length > 0) {
      await admin.storage.from("avatars").remove(toRemove)
    }
  }

  const { error: updateError } = await admin
    .from("fs_employees")
    .update({ avatar_url: null })
    .eq("id", employee.id)

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true })
}
