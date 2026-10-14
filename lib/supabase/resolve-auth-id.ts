import type { SupabaseClient } from "@supabase/supabase-js"

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_REGEX.test(value)
}

export async function resolveAuthId(
  admin: SupabaseClient,
  target: { auth_id?: string | null; email?: string | null },
  emailHint?: string | null
): Promise<string | null> {
  if (isValidUuid(target.auth_id)) {
    return target.auth_id
  }

  const candidates = [emailHint, target.email]
    .filter((e): e is string => typeof e === "string" && e.length > 0)
    .map((e) => e.trim().toLowerCase())

  if (candidates.length === 0) return null

  let page = 1
  const perPage = 1000
  const maxPages = 20

  while (page <= maxPages) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) return null
    const users = data?.users ?? []
    if (users.length === 0) return null

    const match = users.find((u) => {
      const email = u.email?.toLowerCase()
      return email && candidates.includes(email)
    })
    if (match) return match.id

    if (users.length < perPage) return null
    page++
  }

  return null
}
