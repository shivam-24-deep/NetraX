// URL-only investigation — the real counterpart to investigateEmail for
// when the submitted evidence is a bare URL with no surrounding email. Reuses
// the exact same url-analysis/threat-intel/risk-engine modules
// investigateEmail uses; this is deliberately NOT the archived mock URL
// analyzer (frontend/src/lib/mock/analyzers.ts) — no fabricated findings.

import { analyzeUrlWithMl } from "../url-analysis/index.ts";
import { checkIndicator, threatIntelResultToFinding } from "../threat-intel/index.ts";
import type { ThreatIntelLookupResult } from "../threat-intel/types.ts";
import { computeRiskScore } from "../risk-engine/index.ts";
import { buildUrlEvidenceGraph } from "../evidence-graph/builder.ts";
import type { Finding } from "../email/evidence.ts";
import { runTool, skipTool } from "./tool-log.ts";
import type { ToolExecutionRecord, UrlInvestigationResult } from "./types.ts";

export async function investigateUrl(url: string): Promise<UrlInvestigationResult> {
  const toolLog: ToolExecutionRecord[] = [];

  const urlAnalysis = await runTool("url_analysis", toolLog, () => analyzeUrlWithMl(url), (r) => r.findings.length);

  let threatIntelResults: ThreatIntelLookupResult[] = [];
  if (!urlAnalysis.features.isValid) {
    skipTool("threat_intelligence", toolLog, "URL could not be parsed — no valid hostname to check");
  } else {
    threatIntelResults = await runTool(
      "threat_intelligence",
      toolLog,
      async () => {
        const urlChecks = await checkIndicator(url, "url");
        const domainChecks = await checkIndicator(urlAnalysis.features.hostname, "domain");
        return [...urlChecks, ...domainChecks];
      },
      (r) => r.filter((x) => x.status === "matched").length,
    );
  }

  const allFindings: Finding[] = [...urlAnalysis.findings, ...threatIntelResults.map(threatIntelResultToFinding)];
  const riskAssessment = computeRiskScore(allFindings);

  const partialResult = { url, urlAnalysis, threatIntelResults, allFindings, riskAssessment, toolLog };
  const evidenceGraph = buildUrlEvidenceGraph(partialResult);

  return { ...partialResult, evidenceGraph };
}
