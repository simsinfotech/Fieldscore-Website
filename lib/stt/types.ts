/**
 * Speech-to-Text provider abstraction.
 * Allows swapping between Groq, Deepgram, AssemblyAI, etc.
 */

export interface TranscriptSegment {
  start: number // seconds
  end: number
  text: string
  speaker?: string
  confidence?: number
}

export interface TranscriptionResult {
  text: string
  language: string | null
  segments: TranscriptSegment[]
  speakers: { id: string; label: string }[]
  durationSeconds: number | null
  modelVersion: string
}

export interface STTProvider {
  readonly name: string

  /** Transcribe an audio blob, returning text + segments. */
  transcribe(
    audio: Blob,
    options?: TranscribeOptions
  ): Promise<TranscriptionResult>
}

export interface TranscribeOptions {
  language?: string // ISO language code, e.g. "hi", "en"
  prompt?: string // Context hint for the model
  diarize?: boolean // Enable speaker diarization
  format?: "text" | "verbose_json" | "segments"
}
