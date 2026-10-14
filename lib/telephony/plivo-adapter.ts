import type {
  TelephonyProvider,
  TelephonyConfig,
  CallReference,
  NormalizedCallEvent,
  RecordingReference,
  CreateOutboundCallInput,
} from "./types"

/**
 * Plivo adapter — implements TelephonyProvider for Plivo.
 *
 * Key difference from Exotel: Plivo uses an answer_url XML-response pattern.
 * When a call is made, Plivo calls the agent first, then hits the answer_url
 * which returns XML instructions (<Dial> + <Record>) to bridge and record.
 */
export class PlivoAdapter implements TelephonyProvider {
  readonly name = "plivo"

  private authId: string
  private authToken: string

  constructor(private config: TelephonyConfig) {
    this.authId = config.authId || config.apiKey
    this.authToken = config.authToken || config.apiToken
  }

  async createOutboundCall(input: CreateOutboundCallInput): Promise<CallReference> {
    const url = `https://api.plivo.com/v1/Account/${this.authId}/Call/`
    const basicAuth = Buffer.from(`${this.authId}:${this.authToken}`).toString("base64")

    // Build answer_url — Plivo will hit this when the agent picks up
    // to get XML instructions for bridging to the client
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const answerParams = new URLSearchParams({
      client: input.clientPhone,
      record: String(input.record),
    })
    const answerUrl = `${appUrl}/api/webhooks/plivo/answer?${answerParams}`
    const hangupUrl = input.statusCallbackUrl

    const body: Record<string, unknown> = {
      from: input.callerId || this.config.callerId,
      to: input.agentPhone,
      answer_url: answerUrl,
      answer_method: "GET",
      hangup_url: hangupUrl,
      hangup_method: "POST",
    }

    console.log("Plivo createOutboundCall:", JSON.stringify(body))

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basicAuth}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Plivo API error ${res.status}: ${errText}`)
    }

    const json = await res.json()
    const requestUuid = json.request_uuid
    if (!requestUuid) {
      throw new Error("Failed to extract Plivo request_uuid")
    }

    return {
      providerCallId: requestUuid,
      status: "initiated",
      from: input.agentPhone,
      to: input.clientPhone,
    }
  }

  handleWebhook(payload: Record<string, unknown>): NormalizedCallEvent[] {
    const callUuid = (payload.CallUUID || "") as string
    const status = (payload.CallStatus || payload.Event || "") as string
    const from = (payload.From || "") as string
    const to = (payload.To || "") as string
    const duration = parseInt((payload.Duration || payload.BillDuration || "0") as string, 10)
    const recordingUrl = (payload.RecordUrl || payload.RecordingUrl || null) as string | null
    const startTime = (payload.StartTime || "") as string
    const endTime = (payload.EndTime || "") as string

    return [
      {
        providerCallId: callUuid,
        direction: "outbound",
        from,
        to,
        status: this.mapStatus(status),
        durationSeconds: duration,
        recordingUrl,
        startedAt: startTime || new Date().toISOString(),
        endedAt: endTime || null,
        rawPayload: payload,
      },
    ]
  }

  async getRecording(
    _providerCallId: string,
    recordingUrl: string
  ): Promise<RecordingReference | null> {
    if (!recordingUrl) return null

    const basicAuth = Buffer.from(`${this.authId}:${this.authToken}`).toString("base64")

    const res = await fetch(recordingUrl, {
      headers: { Authorization: `Basic ${basicAuth}` },
    })

    if (!res.ok) return null

    return {
      url: recordingUrl,
      durationSeconds: null,
      contentType: res.headers.get("content-type") || "audio/mp3",
    }
  }

  async verifyWebhook(request: Request): Promise<boolean> {
    if (!this.config.webhookSecret) return true

    const url = new URL(request.url)
    const secret = url.searchParams.get("secret")
    return secret === this.config.webhookSecret
  }

  private mapStatus(
    plivoStatus: string
  ): "ringing" | "connected" | "completed" | "failed" | "busy" | "no_answer" {
    switch (plivoStatus.toLowerCase()) {
      case "ringing":
        return "ringing"
      case "in-progress":
      case "answered":
        return "connected"
      case "completed":
        return "completed"
      case "busy":
        return "busy"
      case "no-answer":
        return "no_answer"
      case "failed":
      case "canceled":
      default:
        return "failed"
    }
  }
}
