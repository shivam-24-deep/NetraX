// Phase 4 — Received header chain parsing.
//
// A Received header has no single universal format across MTAs; this parses
// the common "from X by Y with Z for W; date" shape used by the vast
// majority of real-world mail servers. Anything it can't confidently parse
// is left undefined on that hop rather than guessed.

import type { ReceivedHop } from "./types.ts";
import { extractAllIpAddresses } from "../ip-utils.ts";

function extractIps(text: string): string[] {
  return extractAllIpAddresses(text);
}

function extractToken(text: string, keyword: "from" | "by" | "with" | "for"): string | undefined {
  const pattern = new RegExp(`\\b${keyword}\\s+([^\\s;]+(?:\\s+\\([^)]*\\))?(?:\\s+\\[[^\\]]*\\])?)`, "i");
  const match = text.match(pattern);
  if (!match) return undefined;
  // Keep it to the host/token itself; drop a trailing parenthetical/bracket note if it's the whole capture.
  return match[1].split(/\s+\(/)[0].split(/\s+\[/)[0].trim();
}

function extractTimestamp(headerValue: string): string | undefined {
  const lastSemicolon = headerValue.lastIndexOf(";");
  if (lastSemicolon === -1) return undefined;
  const candidate = headerValue.slice(lastSemicolon + 1).trim();
  return candidate.length > 0 ? candidate : undefined;
}

function tryParseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;
  const parsed = new Date(dateStr);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function parseReceivedChain(receivedHeaders: string[]): ReceivedHop[] {
  return receivedHeaders.map((raw, index) => {
    const timestampRaw = extractTimestamp(raw);
    return {
      raw,
      index,
      fromHost: extractToken(raw, "from"),
      byHost: extractToken(raw, "by"),
      withProtocol: extractToken(raw, "with"),
      forAddress: extractToken(raw, "for"),
      timestampRaw,
      timestampParsed: tryParseDate(timestampRaw),
      extractedIps: extractIps(raw),
    };
  });
}

export function collectSourceIpCandidates(chain: ReceivedHop[]): string[] {
  const all = chain.flatMap((hop) => hop.extractedIps);
  return Array.from(new Set(all));
}
