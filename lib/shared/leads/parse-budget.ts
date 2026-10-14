interface BudgetResult {
  min: number | null
  max: number | null
  error?: string
}

const CR_RE = /cr(?:ore)?s?/i
const L_RE = /l(?:akh|ac|acs|akhs)?s?/i
const K_RE = /k/i

function parseToken(token: string): number | null {
  let s = token.trim().replace(/[₹,\s]/g, "")
  if (!s) return null

  let multiplier = 1
  if (CR_RE.test(s)) {
    multiplier = 1_00_00_000
    s = s.replace(CR_RE, "")
  } else if (L_RE.test(s)) {
    multiplier = 1_00_000
    s = s.replace(L_RE, "")
  } else if (K_RE.test(s)) {
    multiplier = 1_000
    s = s.replace(K_RE, "")
  }

  const num = parseFloat(s)
  if (isNaN(num)) return null

  return Math.round(num * multiplier)
}

export function parseBudget(raw: string | undefined | null): BudgetResult {
  if (!raw || typeof raw !== "string") {
    return { min: null, max: null }
  }

  const cleaned = raw.trim()
  if (!cleaned) return { min: null, max: null }

  const rangeMatch = cleaned.split(/\s*[-–—]\s*|\s+to\s+/i)

  if (rangeMatch.length >= 2) {
    const min = parseToken(rangeMatch[0])
    const max = parseToken(rangeMatch[rangeMatch.length - 1])

    if (min === null && max === null) {
      return { min: null, max: null, error: `Cannot parse budget: ${raw}` }
    }

    if (min !== null && max !== null && min > max) {
      return { min: max, max: min }
    }

    return { min, max }
  }

  const val = parseToken(cleaned)
  if (val === null) {
    return { min: null, max: null, error: `Cannot parse budget: ${raw}` }
  }

  return { min: val, max: val }
}
