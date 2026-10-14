import { parsePhoneNumberFromString } from "libphonenumber-js"

interface PhoneResult {
  e164: string | null
  error?: string
}

export function normalizePhone(raw: string | undefined | null): PhoneResult {
  if (!raw || typeof raw !== "string") {
    return { e164: null }
  }

  const cleaned = raw.trim().replace(/[\s\-().]+/g, "")
  if (!cleaned) {
    return { e164: null, error: "Phone number is empty" }
  }

  const phone = parsePhoneNumberFromString(cleaned, "IN")

  if (!phone) {
    return { e164: null, error: `Invalid phone number: ${raw}` }
  }

  if (!phone.isValid()) {
    return { e164: null, error: `Invalid phone number: ${raw}` }
  }

  return { e164: phone.format("E.164") }
}
