/**
 * Maps file column headers to known lead database fields.
 * Uses fuzzy alias matching for common variations.
 */

export type LeadField =
  | "full_name"
  | "phone"
  | "email"
  | "project"
  | "budget"
  | "city"
  | "source"
  | "notes"
  | "created_at"

interface FieldAlias {
  field: LeadField
  aliases: string[]
}

const FIELD_ALIASES: FieldAlias[] = [
  {
    field: "full_name",
    aliases: [
      "name", "full_name", "fullname", "full name", "client name",
      "customer name", "customer", "client", "lead name", "contact name",
      "person", "person name", "buyer name", "buyer",
    ],
  },
  {
    field: "phone",
    aliases: [
      "phone", "phone number", "phone_number", "phonenumber", "mobile",
      "mobile number", "mobile_number", "contact", "contact number",
      "cell", "cell number", "telephone", "tel", "whatsapp",
    ],
  },
  {
    field: "email",
    aliases: [
      "email", "email id", "email_id", "emailid", "email address",
      "e-mail", "mail", "e mail",
    ],
  },
  {
    field: "project",
    aliases: [
      "project", "project name", "project_name", "projectname",
      "property", "property name", "site", "site name", "development",
      "scheme", "township",
    ],
  },
  {
    field: "budget",
    aliases: [
      "budget", "budget range", "budget_range", "price", "price range",
      "amount", "value", "deal value", "deal_value",
    ],
  },
  {
    field: "city",
    aliases: [
      "city", "location", "area", "region", "place", "district",
      "town", "locality",
    ],
  },
  {
    field: "source",
    aliases: [
      "source", "lead source", "lead_source", "leadsource",
      "channel", "medium", "platform", "campaign source",
    ],
  },
  {
    field: "notes",
    aliases: [
      "notes", "note", "remarks", "remark", "comments", "comment",
      "description", "details", "additional info", "info",
    ],
  },
  {
    field: "created_at",
    aliases: [
      "created_time", "created_at", "created date", "created_date",
      "date", "timestamp", "time", "enquiry date", "lead date",
      "submission date", "submitted at", "form date",
    ],
  },
]

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Given file column headers, return a mapping of file column → db field.
 * Unrecognized columns map to "skip".
 */
export function autoMapColumns(
  fileColumns: string[]
): Record<string, LeadField | "skip"> {
  const mapping: Record<string, LeadField | "skip"> = {}
  const usedFields = new Set<LeadField>()

  for (const col of fileColumns) {
    const normalizedCol = normalize(col)
    let matched = false

    for (const { field, aliases } of FIELD_ALIASES) {
      if (usedFields.has(field)) continue

      for (const alias of aliases) {
        if (normalize(alias) === normalizedCol) {
          mapping[col] = field
          usedFields.add(field)
          matched = true
          break
        }
      }
      if (matched) break
    }

    if (!matched) {
      mapping[col] = "skip"
    }
  }

  return mapping
}

/** All recognized lead fields for UI dropdowns */
export const LEAD_FIELDS: { value: LeadField | "skip"; label: string }[] = [
  { value: "skip", label: "Skip (ignore)" },
  { value: "full_name", label: "Full Name" },
  { value: "phone", label: "Phone Number" },
  { value: "email", label: "Email" },
  { value: "project", label: "Project" },
  { value: "budget", label: "Budget" },
  { value: "city", label: "City" },
  { value: "source", label: "Source" },
  { value: "notes", label: "Notes" },
  { value: "created_at", label: "Created Date/Time" },
]
