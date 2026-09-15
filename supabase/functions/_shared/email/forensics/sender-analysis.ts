// Phase 4 — sender identity, display-name spoofing, domain mismatch, and
// lookalike/homoglyph domain findings. Everything here compares literal
// values already present in the parsed headers — no external lookups.

import type { EmailHeaders } from "../types.ts";
import { ABSENT_EVIDENCE, type ForensicFinding } from "./types.ts";
import { KNOWN_BRAND_DOMAINS, KNOWN_BRAND_KEYWORDS, LOW_TRUST_TLDS } from "./brands.ts";
import { levenshteinDistance } from "./levenshtein.ts";
import { analyzeDomainForHomoglyphs } from "./homoglyph.ts";

interface ParsedAddress {
  displayName?: string;
  email?: string;
  domain?: string;
}

/** Parses "Display Name <local@domain>" or a bare "local@domain". Never guesses a missing part. */
export function parseAddress(raw: string | undefined): ParsedAddress {
  if (!raw) return {};
  const angleMatch = raw.match(/^(.*?)<([^>]+)>\s*$/);
  const displayNameRaw = angleMatch ? angleMatch[1].trim().replace(/^"|"$/g, "") : undefined;
  const emailPart = (angleMatch ? angleMatch[2] : raw).trim();
  const emailMatch = emailPart.match(/^([^@\s]+)@([^@\s]+)$/);
  return {
    displayName: displayNameRaw || undefined,
    email: emailMatch ? emailPart.toLowerCase() : undefined,
    domain: emailMatch ? emailMatch[2].toLowerCase() : undefined,
  };
}

function domainOf(raw: string | undefined): string | undefined {
  return parseAddress(raw).domain;
}

function registrableLabelsMatch(a: string, b: string): boolean {
  return a === b;
}

export function analyzeSenderIdentity(headers: EmailHeaders): ForensicFinding[] {
  const findings: ForensicFinding[] = [];
  const from = parseAddress(headers.from);

  if (!headers.from) {
    findings.push({
      id: "from_header_absent",
      finding: "No From header present",
      severity: "medium",
      evidence: ABSENT_EVIDENCE,
      source: "sender_analysis",
      confidence: "high",
      explanation: "Every legitimate email has a From header; its absence itself is unusual and worth noting, though some malformed relays can also drop it in transit.",
    });
    return findings;
  }

  // Display-name brand impersonation: display name mentions a known brand,
  // but the sending domain has nothing to do with that brand's real domain.
  if (from.displayName) {
    const lowerDisplay = from.displayName.toLowerCase();
    for (const keyword of KNOWN_BRAND_KEYWORDS) {
      if (!lowerDisplay.includes(keyword)) continue;
      const brandDomain = Object.keys(KNOWN_BRAND_DOMAINS).find((d) => KNOWN_BRAND_DOMAINS[d] === keyword);
      if (brandDomain && from.domain && !from.domain.endsWith(brandDomain)) {
        findings.push({
          id: "display_name_brand_mismatch",
          finding: `Display name references "${keyword}" but sending domain is unrelated`,
          severity: "high",
          evidence: `From: "${headers.from}"`,
          source: "sender_analysis",
          confidence: "medium",
          explanation: `The display name suggests this email is from ${keyword}, but the actual sending domain "${from.domain}" has no relationship to ${brandDomain}. Display names are attacker-controlled free text and prove nothing about the real sender.`,
        });
      }
    }

    // Display name itself looks like an email address that differs from the actual From address.
    const displayNameAsAddress = parseAddress(from.displayName);
    if (displayNameAsAddress.email && from.email && displayNameAsAddress.email !== from.email) {
      findings.push({
        id: "display_name_address_mismatch",
        finding: "Display name contains a different email address than the actual sender",
        severity: "high",
        evidence: `From: "${headers.from}"`,
        source: "sender_analysis",
        confidence: "high",
        explanation: `The display name shows "${displayNameAsAddress.email}" but mail actually originates from "${from.email}" — a classic display-name spoofing technique since most mail clients show only the display name prominently.`,
      });
    }
  }

  // From vs Reply-To domain mismatch.
  if (headers.replyTo) {
    const replyToDomain = domainOf(headers.replyTo);
    if (from.domain && replyToDomain && !registrableLabelsMatch(from.domain, replyToDomain)) {
      findings.push({
        id: "reply_to_domain_mismatch",
        finding: "Reply-To domain differs from From domain",
        severity: "medium",
        evidence: `From domain: ${from.domain}; Reply-To: ${headers.replyTo}`,
        source: "sender_analysis",
        confidence: "high",
        explanation: "Replies would go to a different organization than the one that appears to have sent this message — a common pattern in business email compromise, though also occasionally legitimate (e.g. no-reply senders redirecting to support).",
      });
    }
  } else {
    findings.push({
      id: "reply_to_absent",
      finding: "No Reply-To header present",
      severity: "info",
      evidence: ABSENT_EVIDENCE,
      source: "sender_analysis",
      confidence: "high",
      explanation: "Most legitimate email has no separate Reply-To; its absence alone is not suspicious.",
    });
  }

  // From vs Return-Path domain mismatch.
  if (headers.returnPath) {
    const returnPathDomain = domainOf(headers.returnPath);
    if (from.domain && returnPathDomain && !registrableLabelsMatch(from.domain, returnPathDomain)) {
      findings.push({
        id: "return_path_domain_mismatch",
        finding: "Return-Path domain differs from From domain",
        severity: "medium",
        evidence: `From domain: ${from.domain}; Return-Path: ${headers.returnPath}`,
        source: "sender_analysis",
        confidence: "medium",
        explanation: "Bounce notifications would go to a different domain than the apparent sender. This happens legitimately with bulk-mail senders (e.g. marketing platforms) as well as in spoofing, so treat as a moderate signal, not proof on its own.",
      });
    }
  } else {
    findings.push({
      id: "return_path_absent",
      finding: "No Return-Path header present",
      severity: "info",
      evidence: ABSENT_EVIDENCE,
      source: "sender_analysis",
      confidence: "high",
      explanation: "Return-Path is often added by the receiving MTA and may legitimately be absent from a submitted/forwarded copy.",
    });
  }

  if (from.domain) {
    findings.push(...analyzeDomainAnomalies(from.domain, "From"));
  }

  return findings;
}

function analyzeDomainAnomalies(domain: string, fieldLabel: string): ForensicFinding[] {
  const findings: ForensicFinding[] = [];

  const tld = domain.split(".").pop() ?? "";
  if (LOW_TRUST_TLDS.has(tld.toLowerCase())) {
    findings.push({
      id: "low_trust_tld",
      finding: `${fieldLabel} domain uses a TLD commonly associated with low-cost/disposable registrations`,
      severity: "low",
      evidence: `Domain: ${domain} (.${tld})`,
      source: "domain_analysis",
      confidence: "low",
      explanation: `".${tld}" is inexpensive and requires minimal verification to register, making it disproportionately popular for short-lived malicious domains. This is a weak signal on its own — many legitimate sites also use these TLDs.`,
    });
  }

  const homoglyph = analyzeDomainForHomoglyphs(domain);
  if (homoglyph.hasPunycodeLabel) {
    findings.push({
      id: "punycode_domain",
      finding: `${fieldLabel} domain uses punycode (internationalized domain) encoding`,
      severity: homoglyph.decodedDomain ? "medium" : "low",
      evidence: `Domain: ${domain}${homoglyph.decodedDomain ? ` (decodes to: ${homoglyph.decodedDomain})` : ""}`,
      source: "domain_analysis",
      confidence: "medium",
      explanation: "Punycode (xn--) domains render as non-Latin/Unicode characters in most mail clients, which can visually mimic a trusted Latin-script brand name. Legitimate internationalized domains exist, so this alone isn't proof of abuse.",
    });
  }
  if (homoglyph.hasNonAsciiCharacters && !homoglyph.hasPunycodeLabel) {
    findings.push({
      id: "unicode_domain",
      finding: `${fieldLabel} domain contains non-ASCII characters`,
      severity: "medium",
      evidence: `Domain: ${domain}`,
      source: "domain_analysis",
      confidence: "medium",
      explanation: "Non-ASCII characters in a domain can be visually indistinguishable from Latin lookalikes (homoglyphs), a known technique for impersonating trusted brands.",
    });
  }

  for (const [brandDomain, brandKeyword] of Object.entries(KNOWN_BRAND_DOMAINS)) {
    if (domain === brandDomain || domain.endsWith("." + brandDomain)) continue; // legitimately the brand or a subdomain of it

    if (homoglyph.normalizedDomain === brandDomain) {
      findings.push({
        id: "homoglyph_brand_impersonation",
        finding: `${fieldLabel} domain visually mimics "${brandDomain}" using confusable characters`,
        severity: "critical",
        evidence: `Domain: ${domain} (normalizes to: ${homoglyph.normalizedDomain})`,
        source: "domain_analysis",
        confidence: "high",
        explanation: `After normalizing look-alike Unicode characters, this domain is character-for-character identical to "${brandDomain}" while not actually being that domain — a strong homoglyph impersonation indicator.`,
      });
      continue;
    }

    // Edit-distance comparison is only meaningful for longer brand names — short
    // ones (e.g. "dhl", "aol"-length strings) collide with unrelated real domains
    // by pure chance at distance <=2, which would falsely flag legitimate short
    // domains as typosquats. The substring/keyword check below has no such
    // problem since it requires literal containment, so it still runs regardless.
    const brandSld = brandDomain.split(".")[0];
    const distance = levenshteinDistance(domain, brandDomain);
    if (brandSld.length >= 5 && distance > 0 && distance <= 2) {
      findings.push({
        id: "typosquat_domain",
        finding: `${fieldLabel} domain closely resembles "${brandDomain}" (possible typosquatting)`,
        severity: "high",
        evidence: `Domain: ${domain} (edit distance ${distance} from ${brandDomain})`,
        source: "domain_analysis",
        confidence: "medium",
        explanation: `This domain differs from "${brandDomain}" by only ${distance} character${distance === 1 ? "" : "s"} — a common typosquatting pattern that relies on visual similarity or typing mistakes.`,
      });
    } else if (domain.includes(brandKeyword.replace(/\s+/g, "")) && !domain.startsWith(brandKeyword.replace(/\s+/g, ""))) {
      findings.push({
        id: "brand_keyword_in_unrelated_domain",
        finding: `${fieldLabel} domain contains brand name "${brandKeyword}" but is not that brand's domain`,
        severity: "high",
        evidence: `Domain: ${domain}`,
        source: "domain_analysis",
        confidence: "medium",
        explanation: `"${brandKeyword}" appears within this domain (e.g. as a subdomain or hyphenated segment), a pattern often used to make an unrelated domain look affiliated with the real brand (whose actual domain is "${brandDomain}").`,
      });
    }
  }

  return findings;
}

export function analyzeMessageId(headers: EmailHeaders): ForensicFinding[] {
  if (!headers.messageId) {
    return [{
      id: "message_id_absent",
      finding: "No Message-ID header present",
      severity: "low",
      evidence: ABSENT_EVIDENCE,
      source: "message_id",
      confidence: "high",
      explanation: "A missing Message-ID is unusual for standards-compliant mail servers, though some legacy or misconfigured systems omit it.",
    }];
  }

  const findings: ForensicFinding[] = [];
  const match = headers.messageId.match(/<[^@>]+@([^>]+)>/);
  const messageIdDomain = match?.[1]?.toLowerCase();
  const fromDomain = domainOf(headers.from);

  if (messageIdDomain && fromDomain && messageIdDomain !== fromDomain && !messageIdDomain.endsWith("." + fromDomain) && !fromDomain.endsWith("." + messageIdDomain)) {
    findings.push({
      id: "message_id_domain_mismatch",
      finding: "Message-ID domain differs from From domain",
      severity: "low",
      evidence: `Message-ID: ${headers.messageId}; From domain: ${fromDomain}`,
      source: "message_id",
      confidence: "low",
      explanation: "The Message-ID is typically generated by the originating mail server and often reflects its domain. A mismatch is common with mailing lists, forwarders, and many legitimate bulk-mail platforms, so this is a weak signal on its own.",
    });
  }

  return findings;
}
