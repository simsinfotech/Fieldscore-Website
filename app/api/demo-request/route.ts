import { NextRequest, NextResponse } from "next/server"
import { appendSheetRow } from "@/lib/google/sheets-client"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const { name, email, phone, company, industry, teamSize, crm, message } =
      body as Record<string, string>

    // Basic validation
    if (!name?.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 })
    }
    if (!email?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Valid email is required" },
        { status: 400 }
      )
    }
    if (!phone?.replace(/\D/g, "") || phone.replace(/\D/g, "").length < 10) {
      return NextResponse.json(
        { error: "Valid phone is required" },
        { status: 400 }
      )
    }
    if (!company?.trim()) {
      return NextResponse.json(
        { error: "Company is required" },
        { status: 400 }
      )
    }

    const sheetId = process.env.DEMO_SHEET_ID
    if (!sheetId) {
      console.error("Missing DEMO_SHEET_ID env variable")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const timestamp = new Date().toISOString()

    await appendSheetRow(sheetId, "Sheet1", [
      timestamp,
      name.trim(),
      email.trim(),
      phone.trim(),
      company.trim(),
      industry || "",
      teamSize || "",
      crm || "",
      message || "",
    ])

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Demo request error:", err)
    return NextResponse.json(
      { error: "Failed to save demo request" },
      { status: 500 }
    )
  }
}
