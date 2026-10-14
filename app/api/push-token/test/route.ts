import { NextRequest, NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase/admin"

/**
 * GET /api/push-token/test
 * Debug endpoint — checks push token status and sends a test push notification.
 * Secured via CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = getSupabaseAdmin()

  // 1. Check which employees have push tokens
  const { data: employees, error } = await admin
    .from("fs_employees")
    .select("id, full_name, expo_push_token, is_active, org_id")
    .eq("is_active", true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const withToken = (employees || []).filter((e) => e.expo_push_token)
  const withoutToken = (employees || []).filter((e) => !e.expo_push_token)

  // 2. Send test push to all employees with tokens
  const pushResults: { name: string; token: string; status: string; response?: string }[] = []

  for (const emp of withToken) {
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: emp.expo_push_token,
          title: "FieldScore Test",
          body: "Push notifications are working!",
          data: { test: true },
          channelId: "new-leads",
        }),
      })

      const responseText = await res.text()
      pushResults.push({
        name: emp.full_name,
        token: emp.expo_push_token,
        status: res.ok ? "sent" : `failed (${res.status})`,
        response: responseText,
      })
    } catch (err) {
      pushResults.push({
        name: emp.full_name,
        token: emp.expo_push_token,
        status: `error: ${err instanceof Error ? err.message : "unknown"}`,
      })
    }
  }

  // 3. Also insert a test in-app notification for each employee with token
  if (withToken.length > 0) {
    await admin.from("fs_notifications").insert(
      withToken.map((emp) => ({
        recipient_id: emp.id,
        type: "test",
        title: "FieldScore Test",
        message: "Push notifications are working!",
        is_read: false,
      }))
    )
  }

  return NextResponse.json({
    total_employees: (employees || []).length,
    with_push_token: withToken.map((e) => ({ name: e.full_name, token: e.expo_push_token })),
    without_push_token: withoutToken.map((e) => e.full_name),
    push_results: pushResults,
  })
}
