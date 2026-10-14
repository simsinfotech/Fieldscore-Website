import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_ROUTES = ["/login", "/reset-password", "/join", "/privacy-policy", "/delete-account"]

export async function updateSession(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://dcyasohbdcnxejxhsjai.supabase.co"
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjeWFzb2hiZGNueGVqeGhzamFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2MzMyNzcsImV4cCI6MjA5MTIwOTI3N30.8x8uSX1QFSY4hnIMt1eXD-Zb7JuE2yajyNjNyE5u3-Y"

  const pathname = request.nextUrl.pathname

  // Skip auth check for landing page, public routes, auth callbacks, and API routes
  if (
    pathname === "/" ||
    pathname === "/signup" ||
    PUBLIC_ROUTES.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/")
  ) {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    // Only check user on /login to handle redirect for already-authenticated users
    if (pathname === "/login") {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const url = request.nextUrl.clone()
        const { data: employee } = await supabase
          .from("fs_employees")
          .select("is_admin")
          .eq("auth_id", user.id)
          .single()

        url.pathname = employee?.is_admin ? "/overview" : "/my-dashboard"
        return NextResponse.redirect(url)
      }
    }

    return supabaseResponse
  }

  // Protected routes: require authentication
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        )
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
