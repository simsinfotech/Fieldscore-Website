import type { STTProvider } from "./types"
import { GroqAdapter } from "./groq-adapter"

type ProviderName = "groq" // | "deepgram" | "assemblyai" — future

/**
 * Get an STT provider by name.
 * Defaults to Groq if not specified.
 */
export function getSTTProvider(name?: ProviderName): STTProvider {
  const providerName = name || (process.env.STT_PROVIDER as ProviderName) || "groq"

  switch (providerName) {
    case "groq":
      return new GroqAdapter()
    // Future providers:
    // case "deepgram": return new DeepgramAdapter()
    // case "assemblyai": return new AssemblyAIAdapter()
    default:
      throw new Error(`Unknown STT provider: ${providerName}`)
  }
}
