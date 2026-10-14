import type { STTProvider, TranscriptionResult, TranscribeOptions } from "./types"

/**
 * Groq Whisper adapter — uses Groq's hosted Whisper API.
 * Model: whisper-large-v3-turbo
 */
export class GroqAdapter implements STTProvider {
  readonly name = "groq"

  private apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.GROQ_API_KEY || ""
    if (!this.apiKey) {
      throw new Error("GROQ_API_KEY is required for GroqAdapter")
    }
  }

  async transcribe(
    audio: Blob,
    options?: TranscribeOptions
  ): Promise<TranscriptionResult> {
    const formData = new FormData()
    formData.append("file", audio, "recording.mp3")
    formData.append("model", "whisper-large-v3-turbo")
    formData.append("response_format", "verbose_json")

    if (options?.language) {
      formData.append("language", options.language)
    }
    if (options?.prompt) {
      formData.append("prompt", options.prompt)
    }

    const res = await fetch(
      "https://api.groq.com/openai/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: formData,
      }
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(`Groq Whisper failed (${res.status}): ${errText}`)
    }

    const data = await res.json()

    // Parse verbose_json response
    const segments = (data.segments || []).map(
      (seg: { start: number; end: number; text: string }) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text?.trim() || "",
      })
    )

    return {
      text: data.text?.trim() || "",
      language: data.language || null,
      segments,
      speakers: [], // Groq Whisper doesn't do diarization
      durationSeconds: data.duration || null,
      modelVersion: "whisper-large-v3-turbo",
    }
  }
}
