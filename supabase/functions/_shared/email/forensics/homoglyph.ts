// Punycode (RFC 3492) decoding + Unicode confusable normalization, both
// needed to catch IDN homoglyph domains (e.g. Cyrillic "а" standing in for
// Latin "a"). A real decoder, not a stub — validated against the RFC 3492
// worked example in homoglyph.test.ts ("mnchen-3ya" -> "münchen").

const BASE = 36, TMIN = 1, TMAX = 26, SKEW = 38, DAMP = 700, INITIAL_BIAS = 72, INITIAL_N = 128;

function adapt(delta: number, numPoints: number, firstTime: boolean): number {
  let d = firstTime ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / numPoints);
  let k = 0;
  while (d > ((BASE - TMIN) * TMAX) >> 1) {
    d = Math.floor(d / (BASE - TMIN));
    k += BASE;
  }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

function digitValue(codeUnit: number): number {
  if (codeUnit >= 48 && codeUnit <= 57) return codeUnit - 22; // '0'-'9' -> 26-35
  if (codeUnit >= 65 && codeUnit <= 90) return codeUnit - 65; // 'A'-'Z' -> 0-25
  if (codeUnit >= 97 && codeUnit <= 122) return codeUnit - 97; // 'a'-'z' -> 0-25
  return -1;
}

/** Decodes a single punycode label (without the "xn--" prefix). Throws on malformed input. */
export function decodePunycodeLabel(input: string): string {
  let n = INITIAL_N;
  let i = 0;
  let bias = INITIAL_BIAS;
  const output: number[] = [];

  const lastDelim = input.lastIndexOf("-");
  const basicLength = lastDelim < 0 ? 0 : lastDelim;
  for (let j = 0; j < basicLength; j++) output.push(input.charCodeAt(j));

  let index = lastDelim >= 0 ? basicLength + 1 : 0;
  const inputLength = input.length;

  while (index < inputLength) {
    const oldi = i;
    let w = 1;
    for (let k = BASE; ; k += BASE) {
      if (index >= inputLength) throw new Error("invalid punycode: truncated");
      const digit = digitValue(input.charCodeAt(index++));
      if (digit < 0) throw new Error("invalid punycode: bad digit");
      i += digit * w;
      const t = k <= bias ? TMIN : k >= bias + TMAX ? TMAX : k - bias;
      if (digit < t) break;
      w *= BASE - t;
    }
    const outLength = output.length + 1;
    bias = adapt(i - oldi, outLength, oldi === 0);
    n += Math.floor(i / outLength);
    i %= outLength;
    output.splice(i, 0, n);
    i++;
  }

  return String.fromCodePoint(...output);
}

export function isPunycodeLabel(label: string): boolean {
  return label.toLowerCase().startsWith("xn--");
}

/** Decodes every "xn--" label in a domain to Unicode; non-punycode labels pass through unchanged. Returns null if any label fails to decode. */
export function decodePunycodeDomain(domain: string): string | null {
  try {
    return domain
      .split(".")
      .map((label) => (isPunycodeLabel(label) ? decodePunycodeLabel(label.slice(4)) : label))
      .join(".");
  } catch {
    return null;
  }
}

// A deliberately small, high-confidence set of Unicode "confusable" characters
// mapped to the Latin letter they're commonly substituted for in homoglyph
// attacks. Not exhaustive (Unicode's own confusables.txt has hundreds) — this
// covers the characters that actually show up in real phishing domains.
const CONFUSABLES: Record<string, string> = {
  "а": "a", "А": "a", // Cyrillic a
  "е": "e", "Е": "e", // Cyrillic ie
  "о": "o", "О": "o", // Cyrillic o
  "р": "p", "Р": "p", // Cyrillic er
  "с": "c", "С": "c", // Cyrillic es
  "х": "x", "Х": "x", // Cyrillic ha
  "у": "y", "У": "y", // Cyrillic u
  "і": "i", "І": "i", // Cyrillic/Ukrainian i
  "ѕ": "s", // Cyrillic dze
  "ј": "j", // Cyrillic je
  "ⅰ": "i",
  "ο": "o", "Ο": "o", // Greek omicron
  "α": "a", // Greek alpha
  "ρ": "p", // Greek rho
  "κ": "k", // Greek kappa
  "υ": "u", // Greek upsilon
  "ı": "i", // dotless i
  "ℓ": "l",
};

export function normalizeConfusables(text: string): string {
  return Array.from(text).map((ch) => CONFUSABLES[ch] ?? ch).join("");
}

export interface HomoglyphAnalysis {
  hasPunycodeLabel: boolean;
  decodedDomain: string | null;
  hasNonAsciiCharacters: boolean;
  normalizedDomain: string;
}

export function analyzeDomainForHomoglyphs(domain: string): HomoglyphAnalysis {
  const lower = domain.toLowerCase();
  const hasPunycodeLabel = lower.split(".").some(isPunycodeLabel);
  const decodedDomain = hasPunycodeLabel ? decodePunycodeDomain(lower) : null;
  const baseForm = decodedDomain ?? lower;
  const hasNonAsciiCharacters = /[^\x00-\x7f]/.test(baseForm);
  return {
    hasPunycodeLabel,
    decodedDomain,
    hasNonAsciiCharacters,
    normalizedDomain: normalizeConfusables(baseForm),
  };
}
