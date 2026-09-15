# Demo Data

**These are synthetic example emails, clearly not real correspondence.**
They exist to exercise every code path in the investigation pipeline
(Phases 3-13) end to end, and to give judges/demo viewers a fast way to see
representative behavior — including one email built with no header
anomalies at all.

None of these are treated as verified threat intelligence anywhere in the
codebase. Running one through `/investigate-email` produces a **real**
result (real parsing, real forensics findings, real risk score) — the input
is synthetic, the analysis of it is not.

| File | Scenario |
|---|---|
| `01-legitimate-corporate.eml` | Ordinary internal email, no anomalies |
| `02-phishing-generic.eml` | Generic phishing: urgency + credential request + typosquat URL |
| `03-ceo-impersonation-bec.eml` | Business Email Compromise: display-name spoofing, wire-transfer request |
| `04-credential-theft.eml` | Fake login-verification email with a homoglyph domain |
| `05-suspicious-invoice.eml` | Fake invoice with financial-language signals and a shortened URL |
| `06-malware-link.eml` | Email linking to a raw-IP malware-hosting URL |
| `07-incomplete-headers.eml` | Minimal headers (no Received, no auth results) — tests graceful "not available" handling |
| `08-benign-with-url.eml` | Legitimate email that happens to contain a URL — should NOT be flagged high-risk |

Run any of them through the real pipeline:

```bash
node server/local-api.ts &   # or use the already-running dev instance
curl -X POST http://localhost:8787/investigate-email \
  -H "Content-Type: application/json" \
  --data-binary @- <<EOF
{"input": $(python3 -c "import json,sys; print(json.dumps(open('data/demo/02-phishing-generic.eml').read()))")}
EOF
```

Or paste any file's contents directly into the Investigate page.
