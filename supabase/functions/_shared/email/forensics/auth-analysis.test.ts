import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeAuthentication } from "./auth-analysis.ts";
import type { EmailHeaders } from "../types.ts";

function baseHeaders(overrides: Partial<EmailHeaders> = {}): EmailHeaders {
  return { to: [], cc: [], bcc: [], received: [], raw: {}, ...overrides };
}

test("reports SPF/DKIM/DMARC as absent explicitly when not present", () => {
  const findings = analyzeAuthentication(baseHeaders());
  assert.ok(findings.some((f) => f.id === "spf_absent" && f.evidence === "Not available in submitted email"));
  assert.ok(findings.some((f) => f.id === "dkim_absent"));
  assert.ok(findings.some((f) => f.id === "dmarc_absent"));
});

test("SPF pass is info severity, SPF fail is high severity", () => {
  const pass = analyzeAuthentication(baseHeaders({ spf: "pass" }));
  const fail = analyzeAuthentication(baseHeaders({ spf: "fail" }));
  assert.equal(pass.find((f) => f.id === "spf_pass")?.severity, "info");
  assert.equal(fail.find((f) => f.id === "spf_fail")?.severity, "high");
});

test("flags SPF pass + DMARC fail alignment inconsistency", () => {
  const findings = analyzeAuthentication(baseHeaders({ spf: "pass", dmarc: "fail" }));
  assert.ok(findings.some((f) => f.id === "spf_pass_dmarc_fail"));
});

test("flags DKIM signing domain mismatch with From domain", () => {
  const findings = analyzeAuthentication(
    baseHeaders({
      from: "a@example.com",
      raw: { "dkim-signature": ["v=1; a=rsa-sha256; d=other-domain.com; s=selector"] },
    }),
  );
  assert.ok(findings.some((f) => f.id === "dkim_signing_domain_mismatch"));
});

test("does not flag DKIM domain mismatch when signing domain matches From", () => {
  const findings = analyzeAuthentication(
    baseHeaders({
      from: "a@example.com",
      raw: { "dkim-signature": ["v=1; a=rsa-sha256; d=example.com; s=selector"] },
    }),
  );
  assert.ok(!findings.some((f) => f.id === "dkim_signing_domain_mismatch"));
});
