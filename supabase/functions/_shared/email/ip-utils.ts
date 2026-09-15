// Shared IPv4/IPv6 extraction, used by both indicator extraction (Phase 3)
// and Received-chain parsing (Phase 4). Centralized because both need the
// same anti-false-positive guard: colon-separated digit groups (times,
// "10:00:00") superficially match a naive IPv6 pattern, so a plausibility
// check is required, not just shape-matching.

export const IPV4_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;

export function extractIpv4Addresses(text: string): string[] {
  return dedupe(text.match(IPV4_PATTERN) ?? []);
}

// A single regex can't correctly express RFC 4291's "::" zero-compression
// grammar (a naive one either rejects valid addresses or matches "10:00:00"
// as if it were one) — instead, a loose candidate regex finds runs of
// hex/colon characters, and isValidIpv6Shape() applies the actual grammar
// rules to decide which candidates are real addresses.
const IPV6_CANDIDATE_PATTERN = /[0-9a-fA-F:]{2,45}/g;

function isValidHexGroup(group: string): boolean {
  return /^[0-9a-fA-F]{1,4}$/.test(group);
}

function isValidIpv6Shape(candidate: string): boolean {
  if (!candidate.includes(":")) return false;
  const doubleColonCount = (candidate.match(/::/g) ?? []).length;
  if (doubleColonCount > 1) return false;

  if (doubleColonCount === 1) {
    const [left, right] = candidate.split("::");
    const leftGroups = left.length ? left.split(":") : [];
    const rightGroups = right.length ? right.split(":") : [];
    if (leftGroups.some((g) => !isValidHexGroup(g))) return false;
    if (rightGroups.some((g) => !isValidHexGroup(g))) return false;
    // "::" must stand in for at least one omitted group, so the explicit
    // groups on both sides must total 7 or fewer (out of a possible 8).
    return leftGroups.length + rightGroups.length <= 7;
  }

  const groups = candidate.split(":");
  return groups.length === 8 && groups.every(isValidHexGroup);
}

export function extractIpv6Addresses(text: string): string[] {
  const candidates = text.match(IPV6_CANDIDATE_PATTERN) ?? [];
  return dedupe(candidates.filter(isValidIpv6Shape));
}

export function extractAllIpAddresses(text: string): string[] {
  return dedupe([...extractIpv4Addresses(text), ...extractIpv6Addresses(text)]);
}

function dedupe(items: string[]): string[] {
  return Array.from(new Set(items));
}
