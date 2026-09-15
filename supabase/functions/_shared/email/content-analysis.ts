// Phase 8-9 — email content analysis: converts Phase 3's literal body-signal
// phrase matches into evidence Findings, and adds the trained ML content
// model's prediction on top when ml/api/server.py is reachable.

import type { BodySignal } from "./types.ts";
import type { Finding } from "./evidence.ts";
import { mlPredictEmail, mlResultToFindings } from "../ml/client.ts";

const SEVERITY_BY_CATEGORY: Record<BodySignal["category"], Finding["severity"]> = {
  urgency: "low",
  financial: "medium",
  credential_request: "high",
  suspicious_instruction: "high",
};

export function bodySignalsToFindings(signals: BodySignal[]): Finding[] {
  return signals.map((signal, i) => ({
    id: `body_signal_${signal.category}_${i}`,
    finding: `Body contains ${signal.category.replace("_", " ")} language: "${signal.matchedPhrase}"`,
    severity: SEVERITY_BY_CATEGORY[signal.category],
    evidence: signal.context,
    source: "content_analysis", // literal phrase match, not yet a model/rule verdict
    confidence: "medium",
    explanation: `This exact phrase appears in the email body. On its own this is a weak signal — many legitimate emails also use urgent or financial language — but it contributes to the overall risk picture alongside header, URL, and model evidence.`,
  }));
}

export async function analyzeEmailContent(bodyText: string, bodySignals: BodySignal[]): Promise<Finding[]> {
  const findings = bodySignalsToFindings(bodySignals);
  if (!bodyText.trim()) return findings;

  const mlResult = await mlPredictEmail(bodyText);
  if (mlResult) {
    findings.push(...mlResultToFindings(mlResult, "ml_email_model"));
  }
  return findings;
}
