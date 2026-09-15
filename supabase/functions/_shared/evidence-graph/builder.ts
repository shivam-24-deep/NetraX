// Phase 12/13 — builds the evidence graph from an investigation result.
//
// Relationship honesty note: Domain -> IP edges represent "this IP appeared
// in the delivery path for mail claiming this From domain" (from the
// Received chain), NOT a verified DNS resolution of the domain to that IP —
// this module does no DNS lookups. URL -> Domain edges ARE direct (the
// domain is parsed straight from the URL string), unlike sender Domain -> IP.

import type { InvestigationResult, UrlInvestigationResult } from "../agent/types.ts";
import type { EvidenceGraph, GraphEdge, GraphNode } from "./types.ts";

function nodeId(type: string, key: string): string {
  return `${type}:${key}`;
}

interface GraphBuilder {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  addNode: (node: GraphNode) => void;
  addEdge: (from: string, to: string, relationship: string) => void;
}

function createGraphBuilder(): GraphBuilder {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  return {
    nodes,
    edges,
    addNode: (node: GraphNode) => {
      if (!nodes.has(node.id)) nodes.set(node.id, node);
    },
    addEdge: (from: string, to: string, relationship: string) => {
      if (!edges.some((e) => e.from === from && e.to === to && e.relationship === relationship)) {
        edges.push({ from, to, relationship });
      }
    },
  };
}

/** Takes everything an InvestigationResult has EXCEPT the graph itself (which this function produces). */
export type GraphSourceData = Omit<InvestigationResult, "evidenceGraph">;

export function buildEvidenceGraph(result: GraphSourceData): EvidenceGraph {
  const { nodes, edges, addNode, addEdge } = createGraphBuilder();

  const emailId = nodeId("email", result.parsedEmail.headers.messageId ?? "submitted-email");
  addNode({
    id: emailId,
    type: "email",
    label: result.parsedEmail.headers.subject ?? "(no subject)",
    data: {
      subject: result.parsedEmail.headers.subject ?? null,
      date: result.parsedEmail.headers.date ?? null,
      messageId: result.parsedEmail.headers.messageId ?? null,
      riskScore: result.riskAssessment.score,
      riskLevel: result.riskAssessment.level,
    },
  });

  // Email -> Sender -> Domain
  let senderDomainId: string | null = null;
  if (result.parsedEmail.headers.from) {
    const senderId = nodeId("sender", result.parsedEmail.headers.from);
    addNode({ id: senderId, type: "sender", label: result.parsedEmail.headers.from, data: { from: result.parsedEmail.headers.from, replyTo: result.parsedEmail.headers.replyTo ?? null, returnPath: result.parsedEmail.headers.returnPath ?? null } });
    addEdge(emailId, senderId, "sent_from");

    const domainMatch = result.parsedEmail.headers.from.match(/@([^\s>]+)/);
    const domain = domainMatch?.[1]?.toLowerCase();
    if (domain) {
      senderDomainId = nodeId("domain", domain);
      addNode({ id: senderDomainId, type: "domain", label: domain, data: { domain } });
      addEdge(senderId, senderDomainId, "belongs_to_domain");
    }
  }

  // Domain/Email -> IP -> ASN -> Country (from geolocation results)
  for (const geo of result.geolocationResults) {
    const ipId = nodeId("ip", geo.ip);
    addNode({ id: ipId, type: "ip", label: geo.ip, data: { ip: geo.ip, lookup: geo.lookup } });
    addEdge(senderDomainId ?? emailId, ipId, "relayed_through");

    if (geo.lookup.status === "found") {
      const { asn, organization, country, countryCode } = geo.lookup.result;
      if (asn !== null) {
        const asnId = nodeId("asn", String(asn));
        addNode({ id: asnId, type: "asn", label: `AS${asn}${organization ? ` (${organization})` : ""}`, data: { asn, organization } });
        addEdge(ipId, asnId, "belongs_to_asn");

        if (country) {
          const countryId = nodeId("country", countryCode ?? country);
          addNode({ id: countryId, type: "country", label: country, data: { country, countryCode } });
          addEdge(asnId, countryId, "located_in");
        }
      } else if (country) {
        const countryId = nodeId("country", countryCode ?? country);
        addNode({ id: countryId, type: "country", label: country, data: { country, countryCode } });
        addEdge(ipId, countryId, "located_in");
      }
    }
  }

  // Email -> URL -> Domain -> Threat Intelligence
  for (const urlResult of result.urlAnalyses) {
    if (!urlResult.features.isValid) continue;
    const urlId = nodeId("url", urlResult.features.url);
    addNode({ id: urlId, type: "url", label: urlResult.features.url, data: { url: urlResult.features.url, findings: urlResult.findings } });
    addEdge(emailId, urlId, "contains_url");

    const urlDomainId = nodeId("domain", urlResult.features.hostname);
    addNode({ id: urlDomainId, type: "domain", label: urlResult.features.hostname, data: { domain: urlResult.features.hostname } });
    addEdge(urlId, urlDomainId, "hosted_on_domain");

    for (const ti of result.threatIntelResults) {
      const tiIndicator = ti.status === "matched" ? ti.result.indicator : ti.indicator;
      if (tiIndicator !== urlResult.features.url && tiIndicator !== urlResult.features.hostname) continue;
      const source = ti.status === "matched" ? ti.result.source : ti.source;
      const tiId = nodeId("threat_intel", `${source}:${tiIndicator}`);
      addNode({ id: tiId, type: "threat_intel", label: `${source}: ${ti.status}`, data: { ...ti } });
      addEdge(tiIndicator === urlResult.features.hostname ? urlDomainId : urlId, tiId, ti.status === "matched" ? "matched_by" : "checked_against");
    }
  }

  // Sender domain checked against threat intel too, if it was.
  if (senderDomainId) {
    const senderDomain = senderDomainId.replace(/^domain:/, "");
    for (const ti of result.threatIntelResults) {
      const tiIndicator = ti.status === "matched" ? ti.result.indicator : ti.indicator;
      if (tiIndicator !== senderDomain) continue;
      const source = ti.status === "matched" ? ti.result.source : ti.source;
      const tiId = nodeId("threat_intel", `${source}:${tiIndicator}`);
      addNode({ id: tiId, type: "threat_intel", label: `${source}: ${ti.status}`, data: { ...ti } });
      addEdge(senderDomainId, tiId, ti.status === "matched" ? "matched_by" : "checked_against");
    }
  }

  return { nodes: Array.from(nodes.values()), edges };
}

/** Takes everything a UrlInvestigationResult has EXCEPT the graph itself. */
export type UrlGraphSourceData = Omit<UrlInvestigationResult, "evidenceGraph">;

/**
 * URL-only graph: URL -> Domain -> Threat Intelligence. There is no Email or
 * Sender node here — unlike investigate-email's synthetic-email workaround
 * this never invents an email that wasn't submitted.
 */
export function buildUrlEvidenceGraph(result: UrlGraphSourceData): EvidenceGraph {
  const { nodes, edges, addNode, addEdge } = createGraphBuilder();

  const { features } = result.urlAnalysis;
  if (!features.isValid) {
    return { nodes: [], edges: [] };
  }

  const urlId = nodeId("url", features.url);
  addNode({
    id: urlId,
    type: "url",
    label: features.url,
    data: { url: features.url, findings: result.urlAnalysis.findings, riskScore: result.riskAssessment.score, riskLevel: result.riskAssessment.level },
  });

  const domainId = nodeId("domain", features.hostname);
  addNode({ id: domainId, type: "domain", label: features.hostname, data: { domain: features.hostname } });
  addEdge(urlId, domainId, "hosted_on_domain");

  for (const ti of result.threatIntelResults) {
    const tiIndicator = ti.status === "matched" ? ti.result.indicator : ti.indicator;
    if (tiIndicator !== features.url && tiIndicator !== features.hostname) continue;
    const source = ti.status === "matched" ? ti.result.source : ti.source;
    const tiId = nodeId("threat_intel", `${source}:${tiIndicator}`);
    addNode({ id: tiId, type: "threat_intel", label: `${source}: ${ti.status}`, data: { ...ti } });
    addEdge(tiIndicator === features.hostname ? domainId : urlId, tiId, ti.status === "matched" ? "matched_by" : "checked_against");
  }

  return { nodes: Array.from(nodes.values()), edges };
}
