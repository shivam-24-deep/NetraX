// Deterministic input-type classification for the mobile/web ingestion flow
// (send.tsx). Mirrors the master spec's classification rules: email headers
// -> EMAIL, a single bare URL -> URL, transaction terminology -> TRANSACTION,
// otherwise free text -> MESSAGE. Never guesses when there's truly nothing to
// go on — UNKNOWN means "ask the user", not "pick something".
//
// Only EMAIL is currently wired to a real backend investigation
// (ingest-service.ts) — URL/MESSAGE/TRANSACTION classification is honest and
// real, but there is no real (non-mock) investigation pipeline for those
// types yet, so the ingest service reports them as unsupported rather than
// routing them through the archived mock analyzers.

export type IngestInputType = "EMAIL" | "URL" | "MESSAGE" | "TRANSACTION" | "UNKNOWN"

export interface ClassificationResult {
  inputType: IngestInputType
  reason: string
}

const EMAIL_HEADER_FIELD = /^(From|To|Cc|Bcc|Subject|Date|Message-ID|Received|MIME-Version|Authentication-Results|Reply-To|Return-Path):/im
const URL_ONLY = /^\s*https?:\/\/\S+\s*$/i
const TRANSACTION_HINT = /\b(transaction\s*id|txn\s*id|utr\s*no\.?|reference\s*no\.?|amount\s*[:₹$]|merchant\s*[:-])/i
const EMAIL_MIME_TYPES = new Set(["message/rfc822"])
const EMAIL_EXTENSIONS = [".eml", ".msg"]

export function classifyInput(input: { text?: string; filename?: string; mimeType?: string }): ClassificationResult {
  const text = (input.text ?? "").trim()
  const filename = (input.filename ?? "").toLowerCase()
  const mimeType = input.mimeType ?? ""

  if (EMAIL_EXTENSIONS.some((ext) => filename.endsWith(ext)) || EMAIL_MIME_TYPES.has(mimeType)) {
    return { inputType: "EMAIL", reason: `Filename or MIME type indicates a raw email (${filename || mimeType}).` }
  }

  if (!text) {
    return { inputType: "UNKNOWN", reason: "No content was provided to classify." }
  }

  const headerMatches = text.match(new RegExp(EMAIL_HEADER_FIELD.source, "gim")) ?? []
  const distinctHeaderFields = new Set(headerMatches.map((m) => m.split(":")[0].toLowerCase()))
  if (distinctHeaderFields.size >= 2) {
    return {
      inputType: "EMAIL",
      reason: `Detected ${distinctHeaderFields.size} distinct email header field(s): ${Array.from(distinctHeaderFields).join(", ")}.`,
    }
  }

  if (URL_ONLY.test(text)) {
    return { inputType: "URL", reason: "Content is a single URL with no surrounding text." }
  }

  if (TRANSACTION_HINT.test(text)) {
    return { inputType: "TRANSACTION", reason: "Content mentions transaction/amount/merchant terminology." }
  }

  return { inputType: "MESSAGE", reason: "Free-form text with no email headers, no standalone URL, and no transaction terminology." }
}
