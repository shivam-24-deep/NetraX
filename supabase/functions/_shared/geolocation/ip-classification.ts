// Phase 7 — private/reserved/localhost IP filtering.
//
// Real CIDR containment checks (integer/bitwise comparison), not string
// prefix matching — "10.0.0.0/8" must correctly match "10.255.255.255" and
// correctly NOT match "100.0.0.0", which a naive `startsWith("10.")` would
// get wrong in the other direction for something like "101.2.3.4".

export type IpClassification =
  | "public"
  | "private"
  | "loopback"
  | "link_local"
  | "reserved"
  | "carrier_grade_nat"
  | "documentation"
  | "multicast"
  | "unspecified"
  | "invalid";

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    result = (result << 8) + n;
  }
  return result >>> 0;
}

function ipv4InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(range);
  if (ipInt === null || rangeInt === null) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

const IPV4_RANGES: Array<{ cidr: string; classification: IpClassification }> = [
  { cidr: "0.0.0.0/8", classification: "reserved" },
  { cidr: "10.0.0.0/8", classification: "private" },
  { cidr: "100.64.0.0/10", classification: "carrier_grade_nat" },
  { cidr: "127.0.0.0/8", classification: "loopback" },
  { cidr: "169.254.0.0/16", classification: "link_local" },
  { cidr: "172.16.0.0/12", classification: "private" },
  { cidr: "192.0.0.0/24", classification: "reserved" },
  { cidr: "192.0.2.0/24", classification: "documentation" },
  { cidr: "192.168.0.0/16", classification: "private" },
  { cidr: "198.18.0.0/15", classification: "reserved" },
  { cidr: "198.51.100.0/24", classification: "documentation" },
  { cidr: "203.0.113.0/24", classification: "documentation" },
  { cidr: "224.0.0.0/4", classification: "multicast" },
  { cidr: "240.0.0.0/4", classification: "reserved" },
];

function classifyIpv4(ip: string): IpClassification {
  if (ipv4ToInt(ip) === null) return "invalid";
  for (const { cidr, classification } of IPV4_RANGES) {
    if (ipv4InCidr(ip, cidr)) return classification;
  }
  return "public";
}

function expandIpv6(ip: string): bigint | null {
  const clean = ip.replace(/^\[|\]$/g, "");
  if (!clean.includes(":")) return null;
  const parts = clean.split("::");
  if (parts.length > 2) return null;

  const parseGroups = (s: string): string[] => (s.length ? s.split(":") : []);
  let head = parseGroups(parts[0]);
  let tail = parts.length === 2 ? parseGroups(parts[1]) : [];

  if (parts.length === 1) {
    if (head.length !== 8) return null;
  } else {
    const missing = 8 - head.length - tail.length;
    if (missing < 0) return null;
    head = [...head, ...Array(missing).fill("0")];
  }
  const groups = [...head, ...tail];
  if (groups.length !== 8) return null;

  let value = 0n;
  for (const g of groups) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
    value = (value << 16n) | BigInt(parseInt(g, 16));
  }
  return value;
}

function ipv6InCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split("/");
  const bits = BigInt(Number(bitsStr));
  const ipVal = expandIpv6(ip);
  const rangeVal = expandIpv6(range);
  if (ipVal === null || rangeVal === null) return false;
  if (bits === 0n) return true;
  const mask = bits === 128n ? (1n << 128n) - 1n : ((1n << bits) - 1n) << (128n - bits);
  return (ipVal & mask) === (rangeVal & mask);
}

const IPV6_RANGES: Array<{ cidr: string; classification: IpClassification }> = [
  { cidr: "::1/128", classification: "loopback" },
  { cidr: "::/128", classification: "unspecified" },
  { cidr: "fc00::/7", classification: "private" },
  { cidr: "fe80::/10", classification: "link_local" },
  { cidr: "ff00::/8", classification: "multicast" },
  { cidr: "2001:db8::/32", classification: "documentation" },
  { cidr: "64:ff9b::/96", classification: "reserved" }, // NAT64
];

/** 6to4 (2002::/16) and NAT64/Teredo-style embeddings carry a real IPv4 address in their bits — that address, not the IPv6 wrapper, determines routability. */
function embeddedIpv4Classification(val: bigint): IpClassification | null {
  const is6to4 = (val >> 112n) === 0x2002n;
  if (!is6to4) return null;
  const embedded = (val >> 80n) & 0xffffffffn;
  const ip = [
    (embedded >> 24n) & 0xffn,
    (embedded >> 16n) & 0xffn,
    (embedded >> 8n) & 0xffn,
    embedded & 0xffn,
  ].join(".");
  return classifyIpv4(ip);
}

function classifyIpv6(ip: string): IpClassification {
  const val = expandIpv6(ip);
  if (val === null) return "invalid";
  for (const { cidr, classification } of IPV6_RANGES) {
    if (ipv6InCidr(ip, cidr)) return classification;
  }
  const embedded = embeddedIpv4Classification(val);
  if (embedded !== null && embedded !== "public") return embedded;
  return "public";
}

export function classifyIp(ip: string): IpClassification {
  return ip.includes(":") ? classifyIpv6(ip) : classifyIpv4(ip);
}

export function isPublicIp(ip: string): boolean {
  return classifyIp(ip) === "public";
}

/** Filters a list of candidate IPs (e.g. from a Received chain) down to public ones only, preserving order. */
export function filterToPublicIps(ips: string[]): string[] {
  return ips.filter(isPublicIp);
}
