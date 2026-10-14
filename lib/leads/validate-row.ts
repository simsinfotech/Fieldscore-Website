import { normalizePhone } from "./normalize-phone"
import { parseBudget } from "./parse-budget"
import { cleanName } from "./clean-name"
import type { LeadField } from "./column-mapper"

interface ValidationError {
  field: string
  message: string
}

interface ValidatedRow {
  parsed: {
    full_name?: string
    phone_e164?: string
    email?: string
    project?: string
    budget_min?: number | null
    budget_max?: number | null
    budget_raw?: string
    city?: string
    source?: string
    notes?: string
    created_at?: string
  }
  errors: ValidationError[]
  isValid: boolean
}

/**
 * Validate and normalize a single row of raw data using the column mapping.
 */
export function validateRow(
  rawData: Record<string, unknown>,
  columnMap: Record<string, LeadField | "skip">
): ValidatedRow {
  const errors: ValidationError[] = []
  const parsed: ValidatedRow["parsed"] = {}

  // Build mapped values: dbField → raw value
  const mapped: Partial<Record<LeadField, string>> = {}
  for (const [fileCol, dbField] of Object.entries(columnMap)) {
    if (dbField === "skip") continue
    const val = rawData[fileCol]
    if (val !== undefined && val !== null && String(val).trim()) {
      mapped[dbField] = String(val).trim()
    }
  }

  // ── Name (required) ──
  const nameResult = cleanName(mapped.full_name)
  if (nameResult.name) {
    parsed.full_name = nameResult.name
  } else {
    errors.push({ field: "full_name", message: nameResult.error || "Name is required" })
  }

  // ── Phone (optional — leads without phone still get created) ──
  const phoneResult = normalizePhone(mapped.phone)
  if (phoneResult.e164) {
    parsed.phone_e164 = phoneResult.e164
  }

  // ── Email (optional, validate format) ──
  if (mapped.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (emailRegex.test(mapped.email)) {
      parsed.email = mapped.email.toLowerCase()
    } else {
      errors.push({ field: "email", message: `Invalid email: ${mapped.email}` })
    }
  }

  // ── Project (optional) ──
  if (mapped.project) {
    parsed.project = mapped.project
  }

  // ── Budget (optional) ──
  if (mapped.budget) {
    parsed.budget_raw = mapped.budget
    const budgetResult = parseBudget(mapped.budget)
    if (budgetResult.error) {
      errors.push({ field: "budget", message: budgetResult.error })
    } else {
      parsed.budget_min = budgetResult.min
      parsed.budget_max = budgetResult.max
    }
  }

  // ── City (optional) ──
  if (mapped.city) {
    parsed.city = mapped.city
  }

  // ── Source (optional) ──
  if (mapped.source) {
    const validSources = ["excel", "website", "referral", "walkin", "social", "other", "google_sheets", "google_ads", "meta_ads", "linkedin"]
    const normalized = mapped.source.toLowerCase().replace(/[\s\-_]+/g, "")
    const sourceMatch = validSources.find((s) => s === normalized)
    parsed.source = sourceMatch || "other"
  }

  // ── Notes (optional) ──
  if (mapped.notes) {
    parsed.notes = mapped.notes
  }

  // ── Created At (optional) ──
  if (mapped.created_at) {
    const d = new Date(mapped.created_at)
    if (!isNaN(d.getTime())) {
      parsed.created_at = d.toISOString()
    }
  }

  return {
    parsed,
    errors,
    isValid: errors.length === 0,
  }
}
