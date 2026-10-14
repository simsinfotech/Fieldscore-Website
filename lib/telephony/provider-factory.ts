import type { SupabaseClient } from "@supabase/supabase-js"
import type { TelephonyProvider, TelephonyConfig } from "./types"
import { ExotelAdapter } from "./exotel-adapter"
import { PlivoAdapter } from "./plivo-adapter"

/** Cache providers per org to avoid re-fetching config on every call. */
const providerCache = new Map<string, { provider: TelephonyProvider; expiresAt: number }>()
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Get the telephony provider for an organization.
 * Returns null for SIM-only orgs (no cloud telephony configured).
 */
export async function getProvider(
  admin: SupabaseClient,
  orgId: string
): Promise<TelephonyProvider | null> {
  // Check cache
  const cached = providerCache.get(orgId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.provider
  }

  // Fetch config from database
  const { data: config } = await admin
    .from("fs_telephony_config")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .maybeSingle()

  if (!config) {
    // No telephony config — SIM-only org
    return null
  }

  const providerName = config.provider || "exotel"

  const telephonyConfig: TelephonyConfig = {
    provider: providerName,
    apiKey: config.api_key,
    apiToken: config.api_token,
    accountSid: config.account_sid || config.api_key,
    subdomain: config.subdomain,
    callerId: config.caller_id,
    webhookSecret:
      providerName === "plivo"
        ? process.env.PLIVO_WEBHOOK_SECRET
        : process.env.EXOTEL_WEBHOOK_SECRET,
    authId: config.auth_id,
    authToken: config.auth_token,
  }

  const provider = createProvider(telephonyConfig)

  // Cache it
  providerCache.set(orgId, {
    provider,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })

  return provider
}

/** Create a provider instance from config. */
function createProvider(config: TelephonyConfig): TelephonyProvider {
  switch (config.provider) {
    case "exotel":
      return new ExotelAdapter(config)
    case "plivo":
      return new PlivoAdapter(config)
    default:
      throw new Error(`Unknown telephony provider: ${config.provider}`)
  }
}

/** Clear the provider cache (useful for config changes). */
export function clearProviderCache(orgId?: string) {
  if (orgId) {
    providerCache.delete(orgId)
  } else {
    providerCache.clear()
  }
}
