import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import { createClient } from "@supabase/supabase-js"

/**
 * GET /api/calls/[id]/recording
 * Serves the recording for a given call, proxied with provider credentials.
 * Auth: Bearer header (via resolveEmployee) OR ?token= query param (for mobile Linking.openURL).
 * Only the call's employee or an admin can access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Try standard auth first, then fall back to query param token
    let caller = await resolveEmployee()

    if (!caller) {
      const token = new URL(request.url).searchParams.get("token")
      if (token) {
        // Verify the token via Supabase and resolve the employee
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        )
        const { data: { user } } = await supabase.auth.getUser(token)
        if (user) {
          const admin = getSupabaseAdmin()
          const { data: emp } = await admin
            .from("fs_employees")
            .select("id, org_id, is_admin")
            .eq("auth_id", user.id)
            .eq("is_active", true)
            .maybeSingle()
          if (emp) {
            caller = {
              employeeId: emp.id,
              orgId: emp.org_id,
              isAdmin: emp.is_admin,
              role: emp.is_admin ? "admin" : "viewer",
              department: null,
            }
          }
        }
      }
    }

    if (!caller) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const admin = getSupabaseAdmin()

    const { data: callRow } = await admin
      .from("call_logs")
      .select("id, employee_id, org_id, recording_url, ingest_source")
      .eq("id", id)
      .maybeSingle()

    if (!callRow) {
      return NextResponse.json({ error: "Call not found" }, { status: 404 })
    }

    // Verify org match
    if (callRow.org_id !== caller.orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Only the call's employee or an admin can access
    if (callRow.employee_id !== caller.employeeId && !caller.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!callRow.recording_url) {
      return NextResponse.json(
        { error: "No recording available for this call" },
        { status: 404 }
      )
    }

    // Branch: Supabase storage (manual upload) vs provider proxy
    if (callRow.recording_url.startsWith("supabase://")) {
      const withoutPrefix = callRow.recording_url.replace("supabase://", "")
      const slashIdx = withoutPrefix.indexOf("/")
      const bucket = withoutPrefix.slice(0, slashIdx)
      const path = withoutPrefix.slice(slashIdx + 1)

      const { data: fileData, error: dlErr } = await admin.storage
        .from(bucket)
        .download(path)

      if (dlErr || !fileData) {
        console.error("Failed to fetch recording from storage:", dlErr)
        return NextResponse.json(
          { error: "Could not fetch recording" },
          { status: 502 }
        )
      }

      const arrayBuf = await fileData.arrayBuffer()
      return new NextResponse(arrayBuf, {
        status: 200,
        headers: {
          "Content-Type": fileData.type || "audio/mpeg",
          "Content-Length": String(arrayBuf.byteLength),
          "Cache-Control": "private, max-age=3600",
        },
      })
    }

    // Look up org's telephony config for auth credentials
    const { data: config } = await admin
      .from("fs_telephony_config")
      .select("provider, api_key, api_token, auth_id, auth_token")
      .eq("org_id", callRow.org_id)
      .eq("is_active", true)
      .maybeSingle()

    if (!config) {
      // No config — try a plain redirect as fallback
      return NextResponse.redirect(callRow.recording_url)
    }

    // Build Basic Auth based on provider
    let basicAuth: string
    if (config.provider === "plivo") {
      const authId = config.auth_id || config.api_key
      const authToken = config.auth_token || config.api_token
      basicAuth = Buffer.from(`${authId}:${authToken}`).toString("base64")
    } else {
      // Exotel or default
      basicAuth = Buffer.from(`${config.api_key}:${config.api_token}`).toString("base64")
    }

    // Proxy the recording with Basic Auth — buffer fully for Vercel compatibility
    const audioRes = await fetch(callRow.recording_url, {
      headers: { Authorization: `Basic ${basicAuth}` },
      redirect: "follow",
    })

    if (!audioRes.ok) {
      console.error("Failed to fetch recording:", audioRes.status, await audioRes.text().catch(() => ""))
      return NextResponse.json(
        { error: `Could not fetch recording (${audioRes.status})` },
        { status: 502 }
      )
    }

    // Buffer the entire audio response for reliable delivery
    const arrayBuf = await audioRes.arrayBuffer()
    const contentType = audioRes.headers.get("content-type") || "audio/mpeg"

    return new NextResponse(arrayBuf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(arrayBuf.byteLength),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (err) {
    console.error("recording route error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
