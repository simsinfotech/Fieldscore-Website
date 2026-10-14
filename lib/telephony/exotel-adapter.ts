import type {
  TelephonyProvider,
  TelephonyConfig,
  CallReference,
  NormalizedCallEvent,
  RecordingReference,
  CreateOutboundCallInput,
} from "./types"

/**
 * Exotel adapter — implements TelephonyProvider for Exotel.
 */
export class ExotelAdapter implements TelephonyProvider {
  readonly name = "exotel"

  constructor(private config: TelephonyConfig) {}

  async createOutboundCall(input: CreateOutboundCallInput): Promise<CallReference> {
    const accountSid = this.config.accountSid || this.config.apiKey
    const url = `https://${this.config.subdomain}/v1/Accounts/${accountSid}/Calls/connect`
    const basicAuth = Buffer.from(
      `${this.config.apiKey}:${this.config.apiToken}`
    ).toString("base64")

    const formData = new URLSearchParams()
    formData.append("From", input.agentPhone)
    formData.append("To", input.clientPhone)
    formData.append("CallerId", input.callerId || this.config.callerId)
    formData.append("Record", input.record ? "true" : "false")
    formData.append("RecordingChannels", "dual")
    formData.append("StatusCallback", input.statusCallbackUrl)
    formData.append("StatusCallbackEvents[0]", "terminal")
    formData.append("StatusCallbackContentType", "application/json")

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: formData.toString(),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Exotel API error ${res.status}: ${errText}`)
    }

    const text = await res.text()
    let sid: string | null = null

    try {
      const json = JSON.parse(text)
      sid = json?.Call?.Sid ?? json?.Sid ?? null
    } catch {
      const match = text.match(/<Sid>([^<]+)<\/Sid>/)
      sid = match?.[1] ?? null
    }

    if (!sid) throw new Error("Failed to extract Exotel call SID")

    return {
      providerCallId: sid,
      status: "initiated",
      from: input.agentPhone,
      to: input.clientPhone,
    }
  }

  handleWebhook(payload: Record<string, unknown>): NormalizedCallEvent[] {
    const sid = (payload.CallSid || payload.Sid || "") as string
    const status = (payload.Status || payload.CallStatus || "") as string
    const from = (payload.From || "") as string
    const to = (payload.To || "") as string
    const duration = parseInt((payload.Duration || payload.RecordingDuration || "0") as string, 10)
    const recordingUrl = (payload.RecordingUrl || null) as string | null
    const startTime = (payload.StartTime || payload.DateCreated || "") as string
    const endTime = (payload.EndTime || payload.DateUpdated || "") as string

    const normalizedStatus = this.mapStatus(status)

    return [
      {
        providerCallId: sid,
        direction: "outbound",
        from,
        to,
        status: normalizedStatus,
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

    const basicAuth = Buffer.from(
      `${this.config.apiKey}:${this.config.apiToken}`
    ).toString("base64")

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
    exotelStatus: string
  ): "ringing" | "connected" | "completed" | "failed" | "busy" | "no_answer" {
    switch (exotelStatus.toLowerCase()) {
      case "ringing":
      case "in-progress":
        return "ringing"
      case "answered":
      case "connected":
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
