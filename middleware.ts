import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // CORS for API routes
  if (pathname.startsWith("/api/")) {
    const origin = request.headers.get("origin") ?? "*"

    // Handle preflight
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Device-Id",
          "Access-Control-Max-Age": "86400",
        },
      })
    }

    // For non-preflight API requests, add CORS headers to the response
    const response = await updateSession(request)
    response.headers.set("Access-Control-Allow-Origin", origin)
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Id")
    return response
  }

  // Auth session management for everything else
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * - public folder assets
     */
    "/((?!_next/static|_next/image|favicon.ico|fieldscore_favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|PNG)$).*)",
  ],
}
