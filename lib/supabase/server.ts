import { createServerClient } from "@supabase/ssr"
import { cookies, headers } from "next/headers"

export function createClient() {
  const cookieStore = cookies()
  const headerStore = headers()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dcyasohbdcnxejxhsjai.supabase.co"
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeWFzb2hiZGNueGVqeGhzamFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MzMyNzcsImV4cCI6MjA5MTIwOTI3N30.8x8uSX1QFSY4hnIMt1eXD-Zb7JuE2yajyNjNyE5u3-Y"

  // Mobile clients send a Bearer token instead of cookies
  const authHeader = headerStore.get("authorization")
  const bearerToken =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null

  const allCookies = cookieStore.getAll()
  const hasCookies = allCookies.length > 0

  return createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return allCookies
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component — ignore
          }
        },
      },
      ...(bearerToken && !hasCookies
        ? { global: { headers: { Authorization: `Bearer ${bearerToken}` } } }
        : {}),
    }
  )
}
