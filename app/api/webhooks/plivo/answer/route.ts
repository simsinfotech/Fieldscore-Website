import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/webhooks/plivo/answer
 * Plivo hits this URL when the agent picks up the call.
 * Returns XML instructions to bridge the call to the client and enable recording.
 *
 * Query params:
 *  - client: The client's phone number to dial
 *  - record: Whether to record the call ("true" / "false")
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const clientPhone = url.searchParams.get("client")
  const record = url.searchParams.get("record") !== "false"

  if (!clientPhone) {
    return new NextResponse(
      `<Response><Speak>Error: no client number provided.</Speak><Hangup/></Response>`,
      {
        status: 200,
        headers: { "Content-Type": "application/xml" },
      }
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
  const recordingCallbackUrl = `${appUrl}/api/webhooks/plivo/recording`

  // Plivo uses a separate <Record> element (NOT a record attribute on <Dial>).
  // startOnDialAnswer="true" starts recording when the B-leg (client) picks up.
  // redirect="false" ensures XML continues to <Dial> after <Record>.
  const recordElement = record
    ? `<Record action="${recordingCallbackUrl}" method="POST" startOnDialAnswer="true" redirect="false" maxLength="3600" fileFormat="mp3" />`
    : ""

  const xml = `<Response>
  ${recordElement}
  <Dial>
    <Number>${clientPhone}</Number>
  </Dial>
</Response>`

  console.log("Plivo answer XML:", xml)

  return new NextResponse(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml" },
  })
}
