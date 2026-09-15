// Small, deliberately conservative reference lists for spoofing/lookalike
// checks. Not exhaustive — expanding this list is safe and low-risk any
// time; it only ever adds coverage, never changes existing behavior.

/** registrable domain -> brand keyword used to spot lookalikes/impersonation in display names. */
export const KNOWN_BRAND_DOMAINS: Record<string, string> = {
  "paypal.com": "paypal",
  "microsoft.com": "microsoft",
  "apple.com": "apple",
  "google.com": "google",
  "amazon.com": "amazon",
  "netflix.com": "netflix",
  "facebook.com": "facebook",
  "instagram.com": "instagram",
  "linkedin.com": "linkedin",
  "dropbox.com": "dropbox",
  "docusign.com": "docusign",
  "bankofamerica.com": "bank of america",
  "chase.com": "chase",
  "wellsfargo.com": "wells fargo",
  "irs.gov": "irs",
  "usps.com": "usps",
  "dhl.com": "dhl",
  "fedex.com": "fedex",
  "adobe.com": "adobe",
  "outlook.com": "outlook",
};

export const KNOWN_BRAND_KEYWORDS = Array.from(new Set(Object.values(KNOWN_BRAND_DOMAINS)));

/** TLDs disproportionately used for disposable/low-cost malicious domain registration. Signal, not proof. */
export const LOW_TRUST_TLDS = new Set([
  "xyz", "top", "support", "click", "link", "work", "icu",
  "gq", "tk", "ml", "cf", "ga", "zip", "mov", "loan", "win",
]);
