// Phase 4 — SPF/DKIM/DMARC result findings + declared-domain alignment checks.
// This reads the RESULT already computed by the receiving mail server
// (Authentication-Results) — it does not re-verify signatures or re-run SPF
// lookups itself, since that would require live DNS queries this module
// deliberately doesn't make.

import type { EmailHeaders } from "../types.ts";
import { ABSENT_EVIDENCE, type ForensicFinding } from "./types.ts";

function severityForAuthResult(result: string): { severity: ForensicFinding["severity"]; isFailure: boolean } {
  switch (result) {
    case "pass":
      return { severity: "info", isFailure: false };
    case "fail":
      return { severity: "high", isFailure: true };
    case "softfail":
      return { severity: "medium", isFailure: true };
    case "neutral":
    case "none":
      return { severity: "low", isFailure: true };
    case "temperror":
    case "permerror":
      return { severity: "medium", isFailure: true };
    default:
      return { severity: "low", isFailure: true };
  }
}

function authFinding(
  mechanism: "SPF" | "DKIM" | "DMARC",
  result: string | undefined,
  source: "authentication",
): ForensicFinding {
  if (!result) {
    return {
      id: `${mechanism.toLowerCase()}_absent`,
      finding: `${mechanism} result not available`,
      severity: "info",
      evidence: ABSENT_EVIDENCE,
      source,
      confidence: "high",
      explanation: `This email's headers include no ${mechanism} result — either the receiving server didn't check it, didn't include the result, or it was stripped before this copy was captured. Absence is not the same as failure.`,
    };
  }
  const { severity, isFailure } = severityForAuthResult(result);
  return {
    id: `${mechanism.toLowerCase()}_${result}`,
    finding: `${mechanism} result: ${result}`,
    severity,
    evidence: `${mechanism.toLowerCase()}=${result}`,
    source,
    confidence: "high",
    explanation: isFailure
      ? `${mechanism} did not pass (result: "${result}"), meaning the receiving server could not fully confirm this message's authenticity via ${mechanism}.`
      : `${mechanism} passed, meaning the receiving server confirmed this message came through an authorized path for ${mechanism}. This does not by itself prove the message content is legitimate.`,
  };
}

export function analyzeAuthentication(headers: EmailHeaders): ForensicFinding[] {
  const findings: ForensicFinding[] = [
    authFinding("SPF", headers.spf, "authentication"),
    authFinding("DKIM", headers.dkim, "authentication"),
    authFinding("DMARC", headers.dmarc, "authentication"),
  ];

  // Alignment inconsistency: SPF passes but DMARC fails (or vice versa) is a real,
  // checkable inconsistency signal — DMARC failing despite SPF passing usually
  // means the SPF-authenticated domain doesn't match the visible From domain.
  if (headers.spf === "pass" && headers.dmarc === "fail") {
    findings.push({
      id: "spf_pass_dmarc_fail",
      finding: "SPF passed but DMARC failed",
      severity: "high",
      evidence: "spf=pass, dmarc=fail",
      source: "authentication",
      confidence: "medium",
      explanation: "This combination typically means the SPF-authenticated sending domain does not align with the visible From domain — a pattern seen when an attacker sends through their own authorized infrastructure while forging the From address to impersonate someone else.",
    });
  }
  if (headers.dkim === "pass" && headers.dmarc === "fail") {
    findings.push({
      id: "dkim_pass_dmarc_fail",
      finding: "DKIM passed but DMARC failed",
      severity: "high",
      evidence: "dkim=pass, dmarc=fail",
      source: "authentication",
      confidence: "medium",
      explanation: "The DKIM signature is valid but for a domain that doesn't align with the visible From domain under DMARC's alignment rules — consistent with a validly-signed message from an unrelated domain impersonating the From address.",
    });
  }

  // DKIM signing domain vs From domain (declared alignment, not signature verification).
  const dkimSignature = headers.raw["dkim-signature"]?.[0];
  if (dkimSignature) {
    const dMatch = dkimSignature.match(/(?:^|;)\s*d=([^;]+)/i);
    const signingDomain = dMatch?.[1]?.trim().toLowerCase();
    const fromMatch = headers.from?.match(/@([^\s>]+)/);
    const fromDomain = fromMatch?.[1]?.toLowerCase();
    if (signingDomain && fromDomain && signingDomain !== fromDomain && !fromDomain.endsWith("." + signingDomain)) {
      findings.push({
        id: "dkim_signing_domain_mismatch",
        finding: "DKIM signing domain (d=) differs from From domain",
        severity: "medium",
        evidence: `DKIM d=${signingDomain}; From domain: ${fromDomain}`,
        source: "authentication",
        confidence: "low",
        explanation: "The domain that signed this message with DKIM is not the same as the visible From domain. This is common and legitimate for mail sent via third-party platforms (e.g. marketing/transactional email services), so treat as a weak signal, not proof of spoofing.",
      });
    }
  }

  return findings;
}
