// Mobile/web-share ingestion (SIH26106 mobile-ingest spec) — the single entry
// point send.tsx calls to turn shared/pasted/uploaded content into a real
// investigation.
//
// Deliberately thin: it reuses the exact same real pipelines, idempotency
// check, and case-storage the existing Investigate page already uses
// (runEmailInvestigation/runUrlInvestigation, findCaseByEmailHash, addCase)
// rather than building a parallel ingestion system — there is only one way a
// case gets created in this app, regardless of whether the input arrived by
// paste, upload, or phone share.

import { sha256Hex } from "@/lib/hash"
import type { InvestigationHandlers } from "@/lib/mock/engine"
import { runEmailInvestigation, runUrlInvestigation } from "@/lib/mock/engine"
import { addCase, findCaseByEmailHash } from "@/lib/mock/store"
import type { FraudCase } from "@/types/fraud"

import { classifyInput, type IngestInputType } from "./classify"

export type IngestSource = "mobile_share" | "web_upload" | "manual"

export interface IngestPayload {
  source: IngestSource
  text: string
  filename?: string
  mimeType?: string
}

export type IngestOutcome =
  | { status: "empty" }
  | { status: "unsupported"; inputType: IngestInputType; reason: string }
  | { status: "backend_unavailable"; inputType: IngestInputType }
  | { status: "duplicate"; inputType: IngestInputType; fraudCase: FraudCase }
  | { status: "completed"; inputType: IngestInputType; fraudCase: FraudCase }

function unsupportedReason(inputType: IngestInputType): string {
  switch (inputType) {
    case "TRANSACTION":
      return "NetraX detected transaction-style content. Automated transaction investigation isn't available from Send to NetraX yet — open Investigate to analyze it manually."
    case "MESSAGE":
      return "NetraX detected free-form message content. Automated message investigation isn't available from Send to NetraX yet — open Investigate to analyze it manually."
    default:
      return "NetraX could not confidently identify what this content is. Open Investigate and select the content type manually."
  }
}

export async function ingestSharedContent(payload: IngestPayload, handlers: InvestigationHandlers = {}): Promise<IngestOutcome> {
  const text = payload.text.trim()
  if (!text) return { status: "empty" }

  const classification = classifyInput({ text, filename: payload.filename, mimeType: payload.mimeType })
  const inputType = classification.inputType

  if (inputType !== "EMAIL" && inputType !== "URL") {
    return { status: "unsupported", inputType, reason: unsupportedReason(inputType) }
  }

  const contentHash = await sha256Hex(text)
  const existing = findCaseByEmailHash(contentHash)
  if (existing) {
    return { status: "duplicate", inputType, fraudCase: existing }
  }

  const result = inputType === "EMAIL" ? await runEmailInvestigation(text, handlers) : await runUrlInvestigation(text, handlers)
  if (!result) {
    return { status: "backend_unavailable", inputType }
  }

  const fraudCase: FraudCase = { ...result, source: payload.source }
  addCase(fraudCase)
  return { status: "completed", inputType, fraudCase }
}
