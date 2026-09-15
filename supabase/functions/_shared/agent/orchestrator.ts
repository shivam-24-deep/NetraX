// Phase 10 — Fraud Investigation Agent: parses an email, then dynamically
// decides which downstream tools are relevant given what's actually in it,
// runs them, and returns one normalized result + a full audit trail.
//
// Dynamic tool selection (per spec): no URLs -> skip URL analysis AND threat
// intel entirely (never called, not called-and-ignored). No public source
// IP -> skip geolocation entirely. A domain intelligence check on the
// sender's own domain always runs when a From address exists, since a
// domain is available in essentially every real email.

import { parseEmail } from "../email/parser.ts";
import type { EmailInputFormat, EmailJsonInput } from "../email/types.ts";
import { analyzeForensics } from "../email/forensics/index.ts";
import { analyzeEmailContent } from "../email/content-analysis.ts";
import { analyzeUrlWithMl, type FullUrlAnalysisResult } from "../url-analysis/index.ts";
import { checkIndicator, threatIntelResultToFinding } from "../threat-intel/index.ts";
import type { ThreatIntelLookupResult } from "../threat-intel/types.ts";
import { geolocateSourceIps, geolocationToFinding } from "../geolocation/index.ts";
import { computeRiskScore } from "../risk-engine/index.ts";
import { buildEvidenceGraph } from "../evidence-graph/builder.ts";
import type { Finding } from "../email/evidence.ts";
import { runTool, skipTool } from "./tool-log.ts";
import type { InvestigationResult, ToolExecutionRecord } from "./types.ts";

export async function investigateEmail(
  input: string | EmailJsonInput,
  formatHint?: EmailInputFormat,
): Promise<InvestigationResult> {
  const toolLog: ToolExecutionRecord[] = [];

  // 1. Parse — always runs, this is the entry point for every other tool.
  const parseStart = new Date().toISOString();
  const parseStartTime = performance.now();
  const parsedEmail = parseEmail(input, formatHint);
  toolLog.push({ tool: "email_parser", status: "success", startedAt: parseStart, durationMs: performance.now() - parseStartTime, findingCount: 0 });

  // 2. Header forensics — always runs; headers may be sparse but that itself is evidence (Phase 4).
  const forensicsReport = await runTool("header_forensics", toolLog, () => Promise.resolve(analyzeForensics(parsedEmail.headers)), (r) => r.findings.length);

  // 3. Content analysis — always attempted; the ML call inside gracefully no-ops if unreachable.
  const bodyText = parsedEmail.body.text ?? parsedEmail.body.htmlAsText ?? "";
  const contentFindings = await runTool("content_analysis", toolLog, () => analyzeEmailContent(bodyText, parsedEmail.bodySignals), (r) => r.length);

  // 4. URL analysis — only for URLs actually found in the email.
  let urlAnalyses: FullUrlAnalysisResult[] = [];
  if (parsedEmail.indicators.urls.length === 0) {
    skipTool("url_analysis", toolLog, "No URLs found in email");
  } else {
    urlAnalyses = await runTool(
      "url_analysis",
      toolLog,
      () => Promise.all(parsedEmail.indicators.urls.map((url) => analyzeUrlWithMl(url))),
      (r) => r.reduce((sum, a) => sum + a.findings.length, 0),
    );
  }

  // 5. Threat intelligence — only for URLs found, plus the sender's own domain when present.
  let threatIntelResults: ThreatIntelLookupResult[] = [];
  const senderDomain = parsedEmail.headers.from?.match(/@([^\s>]+)/)?.[1]?.toLowerCase();
  const hasUrls = parsedEmail.indicators.urls.length > 0;
  if (!hasUrls && !senderDomain) {
    skipTool("threat_intelligence", toolLog, "No URLs and no sender domain found in email");
  } else {
    threatIntelResults = await runTool(
      "threat_intelligence",
      toolLog,
      async () => {
        const urlChecks = await Promise.all(parsedEmail.indicators.urls.map((url) => checkIndicator(url, "url")));
        const domainChecks = senderDomain ? await checkIndicator(senderDomain, "domain") : [];
        return [...urlChecks.flat(), ...domainChecks];
      },
      (r) => r.filter((x) => x.status === "matched").length,
    );
  }

  // 6. Geolocation — only for public IPs found in the Received chain.
  let geolocationResults: Awaited<ReturnType<typeof geolocateSourceIps>> = [];
  if (forensicsReport.sourceIpCandidates.length === 0) {
    skipTool("geolocation", toolLog, "No source IPs found in Received headers");
  } else {
    geolocationResults = await runTool(
      "geolocation",
      toolLog,
      () => geolocateSourceIps(forensicsReport.sourceIpCandidates),
      (r) => r.length,
    );
    if (geolocationResults.length === 0) {
      // Candidates existed but all were private/reserved — update the already-logged entry to say so.
      const entry = toolLog[toolLog.length - 1];
      entry.status = "skipped";
      entry.reason = "All candidate IPs were private/reserved/localhost — no public IP to geolocate";
    }
  }

  const allFindings: Finding[] = [
    ...forensicsReport.findings,
    ...contentFindings,
    ...urlAnalyses.flatMap((a) => a.findings),
    ...threatIntelResults.map(threatIntelResultToFinding),
    ...geolocationResults.map(geolocationToFinding),
  ];

  const riskAssessment = computeRiskScore(allFindings);

  const partialResult = { parsedEmail, forensicsReport, urlAnalyses, threatIntelResults, geolocationResults, contentFindings, allFindings, riskAssessment, toolLog };
  const evidenceGraph = buildEvidenceGraph(partialResult);

  return { ...partialResult, evidenceGraph };
}
