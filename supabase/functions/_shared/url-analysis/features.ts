// Phase 5 — deterministic URL feature extraction: everything computable from
// the URL string alone, no network calls (no following redirects, no WHOIS,
// no DNS). Matches the lexical-feature subset already used by NetraX's
// trained phishing model (ml/src/inference.py::_extract_url_lexical_features)
// plus the additional structural features SIH26106 asks for.

// Kept in sync by hand with ml/src/inference.py's _SHORTENERS — that's the
// Python-side list the trained model's feature actually depends on; this
// TS-side list is used for the same signal in the deterministic findings.
const SHORTENERS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "cutt.ly", "ow.ly", "is.gd", "shorturl.at",
  "goo.gl", "buff.ly", "adf.ly",
]);

export interface UrlFeatures {
  url: string;
  hostname: string;
  isValid: boolean;
  urlLength: number;
  pathLength: number;
  queryParamCount: number;
  subdomainCount: number;
  isIpAsHostname: boolean;
  hasAtSymbol: boolean;
  hasDoubleSlashRedirecting: boolean;
  hasPrefixSuffixDash: boolean;
  isHttps: boolean;
  isShortener: boolean;
  tld: string;
  /** Ratio of "%XX" percent-encoded sequences to total URL length — unusually high values can indicate obfuscation. */
  percentEncodingDensity: number;
}

function isIpHostname(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[[0-9a-fA-F:]+\]$/.test(host);
}

export function extractUrlFeatures(rawUrl: string): UrlFeatures {
  let parsed: URL | null = null;
  try {
    parsed = new URL(rawUrl.includes("://") ? rawUrl : `http://${rawUrl}`);
  } catch {
    parsed = null;
  }

  if (!parsed) {
    return {
      url: rawUrl,
      hostname: "",
      isValid: false,
      urlLength: rawUrl.length,
      pathLength: 0,
      queryParamCount: 0,
      subdomainCount: 0,
      isIpAsHostname: false,
      hasAtSymbol: rawUrl.includes("@"),
      hasDoubleSlashRedirecting: false,
      hasPrefixSuffixDash: false,
      isHttps: false,
      isShortener: false,
      tld: "",
      percentEncodingDensity: 0,
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  const afterProtocol = rawUrl.split("://", 2)[1] ?? rawUrl;
  const labels = hostname.split(".");
  const percentMatches = rawUrl.match(/%[0-9a-fA-F]{2}/g) ?? [];

  return {
    url: rawUrl,
    hostname,
    isValid: true,
    urlLength: rawUrl.length,
    pathLength: parsed.pathname.length,
    queryParamCount: Array.from(parsed.searchParams.keys()).length,
    subdomainCount: Math.max(0, labels.length - 2),
    isIpAsHostname: isIpHostname(hostname),
    hasAtSymbol: rawUrl.includes("@"),
    hasDoubleSlashRedirecting: afterProtocol.includes("//"),
    hasPrefixSuffixDash: hostname.includes("-"),
    isHttps: parsed.protocol === "https:",
    isShortener: SHORTENERS.has(hostname),
    tld: labels.length > 1 ? labels[labels.length - 1] : "",
    percentEncodingDensity: rawUrl.length > 0 ? (percentMatches.length * 3) / rawUrl.length : 0,
  };
}
