// Phase 5 — URL/domain analysis: turns UrlFeatures + brand/homoglyph checks
// (reused from Phase 4's forensics engine — the logic is identical whether
// the domain came from a From header or a URL) into evidence Findings.

import type { Finding } from "../email/evidence.ts";
import { KNOWN_BRAND_DOMAINS, LOW_TRUST_TLDS } from "../email/forensics/brands.ts";
import { levenshteinDistance } from "../email/forensics/levenshtein.ts";
import { analyzeDomainForHomoglyphs } from "../email/forensics/homoglyph.ts";
import { extractUrlFeatures, type UrlFeatures } from "./features.ts";

export interface UrlAnalysisResult {
  features: UrlFeatures;
  findings: Finding[];
}

export function analyzeUrl(rawUrl: string): UrlAnalysisResult {
  const features = extractUrlFeatures(rawUrl);
  const findings: Finding[] = [];

  if (!features.isValid) {
    findings.push({
      id: "url_unparseable",
      finding: "URL could not be parsed",
      severity: "low",
      evidence: rawUrl,
      source: "url_analysis",
      confidence: "high",
      explanation: "This string could not be parsed as a well-formed URL, which is itself unusual for a legitimate link.",
    });
    return { features, findings };
  }

  if (features.isIpAsHostname) {
    findings.push({
      id: "url_ip_as_hostname",
      finding: "URL uses a raw IP address instead of a domain name",
      severity: "high",
      evidence: `Hostname: ${features.hostname}`,
      source: "url_analysis",
      confidence: "high",
      explanation: "Legitimate services almost always use a registered domain name. A bare IP address as the link target is a common phishing/malware-hosting pattern, though some legitimate internal tools also do this.",
    });
  }

  if (features.hasAtSymbol) {
    findings.push({
      id: "url_at_symbol",
      finding: 'URL contains an "@" symbol',
      severity: "high",
      evidence: rawUrl,
      source: "url_analysis",
      confidence: "high",
      explanation: 'Everything before an unencoded "@" in a URL is ignored as userinfo by browsers — attackers use this to make a link display a trusted-looking hostname while it actually navigates elsewhere.',
    });
  }

  if (features.hasDoubleSlashRedirecting) {
    findings.push({
      id: "url_double_slash_redirect",
      finding: 'URL path contains "//" after the protocol',
      severity: "medium",
      evidence: rawUrl,
      source: "url_analysis",
      confidence: "low",
      explanation: 'A second "//" in the path can be used to redirect to a different host on some misconfigured redirectors, though it is also legitimately used to represent an empty path segment.',
    });
  }

  if (!features.isHttps) {
    findings.push({
      id: "url_not_https",
      finding: "URL does not use HTTPS",
      severity: "low",
      evidence: rawUrl,
      source: "url_analysis",
      confidence: "high",
      explanation: "Unencrypted HTTP is increasingly rare for legitimate sites, particularly ones asking for credentials or payment details, though it doesn't by itself indicate malicious intent.",
    });
  }

  if (features.isShortener) {
    findings.push({
      id: "url_shortener",
      finding: "URL uses a link-shortening service",
      severity: "medium",
      evidence: `Hostname: ${features.hostname}`,
      source: "url_analysis",
      confidence: "medium",
      explanation: "Shortened links hide their true destination until clicked. Widely used legitimately, but also a common way to disguise a malicious URL from casual inspection — this module does not follow the link to see where it leads.",
    });
  }

  if (features.percentEncodingDensity > 0.3) {
    findings.push({
      id: "url_excessive_encoding",
      finding: "URL has an unusually high proportion of percent-encoded characters",
      severity: "medium",
      evidence: rawUrl,
      source: "url_analysis",
      confidence: "low",
      explanation: "Heavy percent-encoding can be used to obscure a URL's true content from quick visual inspection or simple keyword filters.",
    });
  }

  if (features.subdomainCount >= 3) {
    findings.push({
      id: "url_excessive_subdomains",
      finding: `URL hostname has an unusually high number of subdomain levels (${features.subdomainCount})`,
      severity: "low",
      evidence: `Hostname: ${features.hostname}`,
      source: "url_analysis",
      confidence: "low",
      explanation: "A long chain of subdomains is sometimes used to bury a brand name deep in a hostname (e.g. \"paypal.com.security-update.example.net\") to make the visible prefix look legitimate at a glance.",
    });
  }

  if (LOW_TRUST_TLDS.has(features.tld)) {
    findings.push({
      id: "url_low_trust_tld",
      finding: `URL uses a TLD commonly associated with low-cost/disposable registrations (.${features.tld})`,
      severity: "low",
      evidence: `Hostname: ${features.hostname}`,
      source: "url_analysis",
      confidence: "low",
      explanation: `".${features.tld}" is inexpensive and requires minimal verification to register. This is a weak signal on its own — many legitimate sites also use these TLDs.`,
    });
  }

  findings.push(...analyzeUrlDomainForBrandAbuse(features.hostname));

  return { features, findings };
}

function analyzeUrlDomainForBrandAbuse(domain: string): Finding[] {
  if (!domain) return [];
  const findings: Finding[] = [];
  const homoglyph = analyzeDomainForHomoglyphs(domain);

  if (homoglyph.hasPunycodeLabel) {
    findings.push({
      id: "url_punycode_domain",
      finding: "URL domain uses punycode (internationalized domain) encoding",
      severity: homoglyph.decodedDomain ? "medium" : "low",
      evidence: `Hostname: ${domain}${homoglyph.decodedDomain ? ` (decodes to: ${homoglyph.decodedDomain})` : ""}`,
      source: "url_analysis",
      confidence: "medium",
      explanation: "Punycode domains can render as non-Latin characters that visually mimic a trusted brand name in some browsers/clients.",
    });
  } else if (homoglyph.hasNonAsciiCharacters) {
    findings.push({
      id: "url_unicode_domain",
      finding: "URL domain contains non-ASCII characters",
      severity: "medium",
      evidence: `Hostname: ${domain}`,
      source: "url_analysis",
      confidence: "medium",
      explanation: "Non-ASCII domain characters can be visually indistinguishable from Latin lookalikes, a known homoglyph impersonation technique.",
    });
  }

  for (const [brandDomain, brandKeyword] of Object.entries(KNOWN_BRAND_DOMAINS)) {
    if (domain === brandDomain || domain.endsWith("." + brandDomain)) continue;

    if (homoglyph.normalizedDomain === brandDomain) {
      findings.push({
        id: "url_homoglyph_brand_impersonation",
        finding: `URL domain visually mimics "${brandDomain}" using confusable characters`,
        severity: "critical",
        evidence: `Hostname: ${domain} (normalizes to: ${homoglyph.normalizedDomain})`,
        source: "url_analysis",
        confidence: "high",
        explanation: `After normalizing look-alike Unicode characters, this domain is identical to "${brandDomain}" while not actually being that domain.`,
      });
      continue;
    }

    const brandSld = brandDomain.split(".")[0];
    const distance = levenshteinDistance(domain, brandDomain);
    if (brandSld.length >= 5 && distance > 0 && distance <= 2) {
      findings.push({
        id: "url_typosquat_domain",
        finding: `URL domain closely resembles "${brandDomain}" (possible typosquatting)`,
        severity: "high",
        evidence: `Hostname: ${domain} (edit distance ${distance} from ${brandDomain})`,
        source: "url_analysis",
        confidence: "medium",
        explanation: `This domain differs from "${brandDomain}" by only ${distance} character${distance === 1 ? "" : "s"}.`,
      });
    } else if (domain.includes(brandKeyword.replace(/\s+/g, "")) && !domain.startsWith(brandKeyword.replace(/\s+/g, ""))) {
      findings.push({
        id: "url_brand_keyword_in_unrelated_domain",
        finding: `URL domain contains brand name "${brandKeyword}" but is not that brand's domain`,
        severity: "high",
        evidence: `Hostname: ${domain}`,
        source: "url_analysis",
        confidence: "medium",
        explanation: `"${brandKeyword}" appears within this domain, a pattern often used to make an unrelated domain look affiliated with the real brand (whose actual domain is "${brandDomain}").`,
      });
    }
  }

  return findings;
}
