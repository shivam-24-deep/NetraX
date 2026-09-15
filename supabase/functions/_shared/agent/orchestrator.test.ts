import { test } from "node:test";
import assert from "node:assert/strict";
import { investigateEmail } from "./orchestrator.ts";

function crlf(lines: string[]): string {
  return lines.join("\r\n");
}

test("skips URL analysis and threat intel entirely when the email has no URLs and no sender domain", async () => {
  const raw = crlf(["Date: Mon, 1 Sep 2025 10:00:00 +0000", "", "Just a plain message with no links or sender."]);
  const result = await investigateEmail(raw);
  const urlTool = result.toolLog.find((t) => t.tool === "url_analysis");
  const tiTool = result.toolLog.find((t) => t.tool === "threat_intelligence");
  assert.equal(urlTool?.status, "skipped");
  assert.equal(tiTool?.status, "skipped");
  assert.deepEqual(result.urlAnalyses, []);
});

test("skips geolocation when there are no Received headers at all", async () => {
  const raw = crlf(["From: a@example.com", "Subject: Hi", "", "Body text"]);
  const result = await investigateEmail(raw);
  const geoTool = result.toolLog.find((t) => t.tool === "geolocation");
  assert.equal(geoTool?.status, "skipped");
  assert.match(geoTool!.reason!, /no source ip/i);
});

test("skips geolocation when candidate IPs exist but are all private", async () => {
  const raw = crlf([
    "From: a@example.com",
    "Received: from internal.corp (internal.corp [10.0.0.5]) by mx.example.com; Mon, 1 Sep 2025 10:00:00 +0000",
    "",
    "Body text",
  ]);
  const result = await investigateEmail(raw);
  const geoTool = result.toolLog.find((t) => t.tool === "geolocation");
  assert.equal(geoTool?.status, "skipped");
  assert.match(geoTool!.reason!, /private\/reserved/i);
});

test("attempts URL analysis and threat intel when a URL is present, and still produces findings", async () => {
  const raw = crlf(["From: a@example.com", "Subject: Check this", "", "Visit http://paypa1.com/login now"]);
  const result = await investigateEmail(raw);
  const urlTool = result.toolLog.find((t) => t.tool === "url_analysis");
  assert.equal(urlTool?.status, "success");
  assert.equal(result.urlAnalyses.length, 1);
  assert.ok(result.urlAnalyses[0].findings.some((f) => f.id === "url_typosquat_domain"));
});

test("attempts geolocation when a public source IP is present in the Received chain", async () => {
  const raw = crlf([
    "From: a@example.com",
    "Received: from mail.sender.com (mail.sender.com [8.8.8.8]) by mx.example.com; Mon, 1 Sep 2025 10:00:00 +0000",
    "",
    "Body text",
  ]);
  const result = await investigateEmail(raw);
  const geoTool = result.toolLog.find((t) => t.tool === "geolocation");
  assert.equal(geoTool?.status, "success");
  // No MaxMind credentials in this test environment -> gracefully "unavailable", not skipped, not fabricated.
  assert.equal(result.geolocationResults.length, 1);
  assert.equal(result.geolocationResults[0].lookup.status, "unavailable");
});

test("always runs header forensics and content analysis, producing real findings", async () => {
  const raw = crlf([
    "From: PayPal Security <security@totally-not-paypal.xyz>",
    "Reply-To: attacker@other.com",
    "",
    "Please verify your password immediately, urgent!",
  ]);
  const result = await investigateEmail(raw);
  assert.ok(result.forensicsReport.findings.some((f) => f.id === "display_name_brand_mismatch"));
  assert.ok(result.contentFindings.some((f) => f.id.startsWith("body_signal_credential_request")));
  assert.ok(result.allFindings.length >= result.forensicsReport.findings.length);
});

test("produces a risk assessment derived from the collected findings, LOW for a clean email", async () => {
  // Note: does not assert score === 0 — if a local ML API happens to be running
  // (ml/api/server.py), its content-model prediction is legitimately included
  // as a small-but-nonzero contribution even for benign text. That's correct
  // behavior, not a bug; only the LOW/MEDIUM/HIGH/CRITICAL band is asserted.
  const raw = crlf(["From: colleague@company.com", "Subject: Lunch?", "", "Hey, still on for lunch tomorrow at 1pm?"]);
  const result = await investigateEmail(raw);
  assert.equal(result.riskAssessment.level, "LOW");
  assert.ok(result.riskAssessment.score < 25);
});

test("produces a higher risk assessment for an email with multiple corroborating red flags", async () => {
  const raw = crlf([
    "From: PayPal Security <security@totally-not-paypal.xyz>",
    "Reply-To: attacker@other.com",
    "Authentication-Results: mx.google.com; spf=fail; dkim=fail; dmarc=fail",
    "",
    "Please verify your password immediately, urgent! Visit http://paypa1.com/login",
  ]);
  const result = await investigateEmail(raw);
  assert.ok(result.riskAssessment.score > 0);
  assert.notEqual(result.riskAssessment.level, "LOW");
  assert.ok(result.riskAssessment.topReasons.length > 0);
});

test("tool log always includes email_parser as the first successful step", async () => {
  const result = await investigateEmail("plain text with no headers");
  assert.equal(result.toolLog[0].tool, "email_parser");
  assert.equal(result.toolLog[0].status, "success");
});
