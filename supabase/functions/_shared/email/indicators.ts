// Phase 3 — indicator extraction: URLs, domains, addresses, and literal
// body-text signal matches. Every function here returns what is literally
// present in the input — pattern matches, not judgments. Whether a given
// URL/domain/phrase is actually malicious is Phase 4+'s job, not this one's.

import type { BodySignal, BodySignalCategory } from "./types.ts";
import { extractAllIpAddresses } from "./ip-utils.ts";

const URL_PATTERN = /\bhttps?:\/\/[^\s<>"'\)\]]+/gi;
// Note: RFC 5322 atext legally allows "%/=?&" etc. in an unquoted local part,
// so a small amount of adjacent template/URL noise can occasionally attach to
// an otherwise-real address (e.g. a legacy mail-merge tag like "%EM%x@y.com%/EM%")
// — extractEmailAddresses() below trims the common single-leading-character
// case; wrapping tags are a known, accepted limitation rather than something
// worth a bespoke regex for.
const EMAIL_PATTERN = /[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+/g;
// Loose international phone pattern — intentionally permissive; document as heuristic, expect some false positives (e.g. reference numbers).
const PHONE_PATTERN = /(?:\+\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]\d{3,4}[-.\s]\d{3,4}\b/g;
const BTC_PATTERN = /\b(?:bc1[a-z0-9]{25,39}|[13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g;
const ETH_PATTERN = /\b0x[a-fA-F0-9]{40}\b/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_PATTERN) ?? [];
  return dedupe(matches.map((u) => u.replace(/[.,;:!?]+$/, "")));
}

export function extractDomainsFromUrls(urls: string[]): string[] {
  const domains: string[] = [];
  for (const url of urls) {
    try {
      domains.push(new URL(url).hostname.toLowerCase());
    } catch {
      // malformed URL — skip rather than guess a hostname
    }
  }
  return dedupe(domains);
}

export function extractEmailAddresses(text: string): string[] {
  const matches = text.match(EMAIL_PATTERN) ?? [];
  // "%", "/", "=", "?", "&" are legal RFC 5322 atext but in practice, when one
  // of these appears as the very first character of a match, it's virtually
  // always template/URL artifact bleeding in (e.g. an unresolved mail-merge
  // placeholder "%EM%name@x.com%/EM%") rather than a real local-part — trim it.
  const cleaned = matches.map((e) => e.replace(/^[%/=?&]+/, ""));
  return dedupe(cleaned.map((e) => e.toLowerCase()));
}

export function extractIpAddresses(text: string): string[] {
  return extractAllIpAddresses(text);
}

export function extractPhoneNumbers(text: string): string[] {
  const matches = text.match(PHONE_PATTERN) ?? [];
  // Require at least 7 digits total to cut down on false positives like "12-34".
  return dedupe(matches.filter((m) => (m.match(/\d/g) ?? []).length >= 7));
}

export function extractCryptoAddresses(text: string): string[] {
  const btc = text.match(BTC_PATTERN) ?? [];
  const eth = text.match(ETH_PATTERN) ?? [];
  return dedupe([...btc, ...eth]);
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}

// --- Body signals -----------------------------------------------------
// Deterministic phrase matching only. These are evidence items ("this literal
// phrase appears in the body"), never a suspicious/not-suspicious verdict —
// the risk engine (Phase 11) decides what matched phrases are worth.

const PHRASE_LISTS: Record<BodySignalCategory, string[]> = {
  urgency: [
    "urgent",
    "immediately",
    "act now",
    "act immediately",
    "account will be suspended",
    "account has been locked",
    "action required",
    "within 24 hours",
    "within 48 hours",
    "final notice",
    "immediate attention",
    "time-sensitive",
    "expires today",
  ],
  financial: [
    "wire transfer",
    "bank account",
    "routing number",
    "swift code",
    "invoice attached",
    "payment details",
    "outstanding balance",
    "overdue payment",
    "tax refund",
    "gift card",
    "bitcoin",
    "cryptocurrency payment",
  ],
  credential_request: [
    "verify your password",
    "confirm your password",
    "enter your password",
    "login credentials",
    "update your payment information",
    "click here to verify",
    "reset your password",
    "one-time password",
    "one time password",
    " otp ",
    "social security number",
    " ssn ",
    "confirm your identity",
    "verify your account",
  ],
  suspicious_instruction: [
    "do not tell",
    "keep this confidential",
    "do not inform your bank",
    "purchase gift cards",
    "wire the funds",
    "reply to this email only",
    "this is not a scam",
    "do not discuss this",
  ],
};

export function extractBodySignals(text: string): BodySignal[] {
  const signals: BodySignal[] = [];
  const lower = text.toLowerCase();
  for (const [category, phrases] of Object.entries(PHRASE_LISTS) as [BodySignalCategory, string[]][]) {
    for (const phrase of phrases) {
      const idx = lower.indexOf(phrase.toLowerCase());
      if (idx === -1) continue;
      const start = Math.max(0, idx - 30);
      const end = Math.min(text.length, idx + phrase.length + 30);
      signals.push({
        category,
        matchedPhrase: phrase.trim(),
        context: text.slice(start, end).trim(),
      });
    }
  }
  return signals;
}
