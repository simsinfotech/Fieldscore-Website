import { NextRequest, NextResponse } from "next/server"
import { resolveEmployee } from "@/lib/attendance/resolve-employee"
import { getSupabaseAdmin } from "@/lib/supabase/admin"
import crypto from "crypto"

/**
 * POST /api/documents/[id]/share
 * Create a tracked share link for a document.
 * body: { recipient_name?, recipient_phone?, recipient_email?, channel?, expires_hours? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const caller = await resolveEmployee()
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: documentId } = await params
  const body = await request.json()
  const admin = getSupabaseAdmin()

  // Verify document belongs to caller's org
  const { data: doc } = await admin
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("org_id", caller.orgId)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 })

  const shareToken = crypto.randomBytes(32).toString("hex")
  const expiresAt = body.expires_hours
    ? new Date(Date.now() + body.expires_hours * 60 * 60 * 1000).toISOString()
    : null

  const { data: share, error } = await admin
    .from("document_shares")
    .insert({
      document_id: documentId,
      shared_by: caller.employeeId,
      share_token: shareToken,
      recipient_name: body.recipient_name || null,
      recipient_phone: body.recipient_phone || null,
      recipient_email: body.recipient_email || null,
      channel: body.channel || "link",
      expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    console.error("document share error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ share }, { status: 201 })
}
