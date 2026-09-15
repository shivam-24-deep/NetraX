import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEvidenceGraph, type GraphSourceData } from "./builder.ts";

function baseResult(overrides: Partial<GraphSourceData> = {}): GraphSourceData {
  return {
    parsedEmail: {
      format: "eml",
      headers: { to: [], cc: [], bcc: [], received: [], raw: {}, from: "attacker@evil.example", subject: "Test" },
      body: {},
      indicators: { urls: [], domains: [], emailAddresses: [], ipAddresses: [], phoneNumbers: [], cryptoAddresses: [], attachments: [] },
      bodySignals: [],
      warnings: [],
    },
    forensicsReport: { findings: [], receivedChain: [], sourceIpCandidates: [] },
    urlAnalyses: [],
    threatIntelResults: [],
    geolocationResults: [],
    contentFindings: [],
    allFindings: [],
    riskAssessment: { score: 0, level: "LOW", breakdown: [], topReasons: [] },
    toolLog: [],
    ...overrides,
  };
}

test("builds Email -> Sender -> Domain chain when From is present", () => {
  const graph = buildEvidenceGraph(baseResult());
  const domainNode = graph.nodes.find((n) => n.type === "domain");
  assert.ok(domainNode);
  assert.equal(domainNode!.label, "evil.example");
  assert.ok(graph.edges.some((e) => e.relationship === "sent_from"));
  assert.ok(graph.edges.some((e) => e.relationship === "belongs_to_domain"));
});

test("builds Domain -> IP -> ASN -> Country chain from geolocation results", () => {
  const result = baseResult({
    geolocationResults: [
      {
        ip: "8.8.8.8",
        lookup: { status: "found", result: { ip: "8.8.8.8", country: "United States", countryCode: "US", region: null, city: null, asn: 15169, organization: "GOOGLE", network: null, accuracyRadiusKm: 1000 } },
      },
    ],
  });
  const graph = buildEvidenceGraph(result);
  assert.ok(graph.nodes.some((n) => n.type === "ip" && n.label === "8.8.8.8"));
  assert.ok(graph.nodes.some((n) => n.type === "asn"));
  assert.ok(graph.nodes.some((n) => n.type === "country" && n.label === "United States"));
  assert.ok(graph.edges.some((e) => e.relationship === "relayed_through"));
  assert.ok(graph.edges.some((e) => e.relationship === "belongs_to_asn"));
  assert.ok(graph.edges.some((e) => e.relationship === "located_in"));
});

test("builds Email -> URL -> Domain -> ThreatIntel chain", () => {
  const result = baseResult({
    urlAnalyses: [{ features: { url: "http://evil.example/x", hostname: "evil.example", isValid: true, urlLength: 20, pathLength: 2, queryParamCount: 0, subdomainCount: 0, isIpAsHostname: false, hasAtSymbol: false, hasDoubleSlashRedirecting: false, hasPrefixSuffixDash: false, isHttps: false, isShortener: false, tld: "example", percentEncodingDensity: 0 }, findings: [] }],
    threatIntelResults: [
      { status: "matched", result: { indicator: "http://evil.example/x", indicator_type: "url", matched: true, source: "URLhaus", confidence: "high", first_seen: null, last_seen: null, category: "malware_download", metadata: {} } },
    ],
  });
  const graph = buildEvidenceGraph(result);
  assert.ok(graph.nodes.some((n) => n.type === "url"));
  assert.ok(graph.nodes.some((n) => n.type === "threat_intel"));
  assert.ok(graph.edges.some((e) => e.relationship === "contains_url"));
  assert.ok(graph.edges.some((e) => e.relationship === "hosted_on_domain"));
  assert.ok(graph.edges.some((e) => e.relationship === "matched_by"));
});

test("does not duplicate the domain node when sender and URL share the same domain", () => {
  const result = baseResult({
    urlAnalyses: [{ features: { url: "http://evil.example/x", hostname: "evil.example", isValid: true, urlLength: 20, pathLength: 2, queryParamCount: 0, subdomainCount: 0, isIpAsHostname: false, hasAtSymbol: false, hasDoubleSlashRedirecting: false, hasPrefixSuffixDash: false, isHttps: false, isShortener: false, tld: "example", percentEncodingDensity: 0 }, findings: [] }],
  });
  const graph = buildEvidenceGraph(result);
  const domainNodes = graph.nodes.filter((n) => n.type === "domain" && n.label === "evil.example");
  assert.equal(domainNodes.length, 1);
});

test("handles an email with no From, no URLs, and no geolocation gracefully (just the Email node)", () => {
  const result = baseResult({ parsedEmail: { ...baseResult().parsedEmail, headers: { to: [], cc: [], bcc: [], received: [], raw: {} } } });
  const graph = buildEvidenceGraph(result);
  assert.equal(graph.nodes.length, 1);
  assert.equal(graph.nodes[0].type, "email");
  assert.equal(graph.edges.length, 0);
});
