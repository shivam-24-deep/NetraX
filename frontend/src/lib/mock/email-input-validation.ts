// Client-side guardrails for the "Analyze Email" upload path. The backend
// parser (supabase/functions/_shared/email/parser.ts) already tolerates
// malformed MIME gracefully — these checks exist to fail fast with a clear
// message before a bad file ever reaches it, and to bound resource use.

export const MAX_EMAIL_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
export const MAX_PASTED_CHARS = 2 * 1024 * 1024 // 2M chars

const ALLOWED_EXTENSIONS = [".eml", ".txt", ".msg"]

export interface ValidationResult {
  ok: boolean
  error?: string
}

export function validateEmailFile(file: File): ValidationResult {
  const name = file.name.toLowerCase()
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext))
  const hasAllowedMimeType = file.type === "" || file.type === "message/rfc822" || file.type.startsWith("text/")

  if (!hasAllowedExtension && !hasAllowedMimeType) {
    return { ok: false, error: "Unsupported file type. Upload a .eml, .msg, or .txt file." }
  }
  if (file.size === 0) {
    return { ok: false, error: "The selected file is empty." }
  }
  if (file.size > MAX_EMAIL_FILE_BYTES) {
    return { ok: false, error: `File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_EMAIL_FILE_BYTES / 1024 / 1024} MB.` }
  }
  return { ok: true }
}

export function validatePastedEmail(content: string): ValidationResult {
  if (content.trim().length === 0) {
    return { ok: false, error: "Paste an email before starting the investigation." }
  }
  if (content.length > MAX_PASTED_CHARS) {
    return { ok: false, error: "Pasted content is too large. Upload it as a .eml file instead." }
  }
  return { ok: true }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "")
    reader.onerror = () => reject(new Error("Unable to read the selected file."))
    reader.readAsText(file)
  })
}
