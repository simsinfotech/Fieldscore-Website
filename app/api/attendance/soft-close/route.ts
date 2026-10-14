import { NextResponse } from "next/server"

// Soft-close is intentionally disabled. Attendance sessions must persist
// until the user manually checks out or the end-of-day auto-close fires.
// Closing the browser tab or switching apps should NOT end the session.
export async function POST() {
  return NextResponse.json({ closed: false, reason: "disabled" })
}
