export function cleanName(raw: string | undefined | null): {
  name: string | null
  error?: string
} {
  if (!raw || typeof raw !== "string") {
    return { name: null, error: "Name is required" }
  }

  let name = raw.trim()

  name = name.replace(/[^a-zA-Z\s.\-']/g, "")
  name = name.replace(/\s+/g, " ").trim()

  if (!name || name.length < 2) {
    return { name: null, error: "Name is too short" }
  }

  name = name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")

  return { name }
}
