/**
 * Telephony provider abstraction.
 * Decouples business logic from specific providers (Exotel, Twilio, etc.)
 * SIM-only orgs don't need any provider config.
 */

export interface CallReference {
  providerCallId: string
  status: "initiated" | "ringing" | "connected" | "completed" | "failed"
  from: string
  to: string
}

export interface RecordingReference {
  url: string
  durationSeconds: number | null
  contentType: string
}

export interface NormalizedCallEvent {
  providerCallId: string
  direction: "inbound" | "outbound"
  from: string
  to: string
  status: "ringing" | "connected" | "completed" | "failed" | "busy" | "no_answer"
  durationSeconds: number
  recordingUrl: string | null
  startedAt: string
  endedAt: string | null
  rawPayload: Record<string, unknown>
}

export interface CreateOutboundCallInput {
  agentPhone: string
  clientPhone: string
  callerId: string
  record: boolean
  statusCallbackUrl: string
  metadata?: Record<string, string>
}

export interface TelephonyProvider {
  /** Unique provider identifier. */
  readonly name: string

  /** Initiate an outbound bridged call. */
  createOutboundCall(input: CreateOutboundCallInput): Promise<CallReference>

  /** Parse an incoming webhook payload into normalized events. */
  handleWebhook(payload: Record<string, unknown>): NormalizedCallEvent[]

  /** Download a recording by provider reference. */
  getRecording(
    providerCallId: string,
    recordingUrl: string
  ): Promise<RecordingReference | null>

  /** Verify webhook authenticity (HMAC, secret, etc.). */
  verifyWebhook(request: Request): Promise<boolean>
}

export interface TelephonyConfig {
  provider: "exotel" | "plivo" | "twilio" | "sim_only"
  apiKey: string
  apiToken: string
  accountSid: string
  subdomain: string
  callerId: string
  webhookSecret?: string
  /** Plivo Auth ID (stored per-org in fs_telephony_config table) */
  authId?: string
  /** Plivo Auth Token (stored per-org in fs_telephony_config table) */
  authToken?: string
}
