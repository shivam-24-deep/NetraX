# Agent Architecture

The investigation agent (`supabase/functions/_shared/agent/orchestrator.ts`)
is a deterministic orchestrator with **dynamic tool selection** — not an
LLM making free-form decisions. This document explains what "agentic" means
in this codebase and why.

## Flow

```
Submitted email
      |
Email Parser (always runs — the entry point)
      |
Header Forensics (always runs — headers may be sparse, but that's evidence too)
      |
Content Analysis (always attempted — ML call gracefully no-ops if unreachable)
      |
   [URLs found?] --no--> URL Analysis SKIPPED, Threat Intel SKIPPED
      |yes
URL Analysis  ->  Threat Intelligence (URLs + sender domain)
      |
   [public source IP found?] --no--> Geolocation SKIPPED
      |yes
Geolocation
      |
Risk Engine (deterministic, see docs/RISK_SCORING.md)
      |
Evidence Graph (visualization of the same evidence, no new claims)
```

## Why "dynamic tool selection" and not "run everything always"

Per the SIH26106 spec: an email with no URL should never trigger URL/threat-
intel tools, and an email with no public source IP should never trigger
geolocation. This isn't a performance optimization — it's an honesty
requirement. Calling a tool on nothing and getting back an empty result
looks identical to "not needed" in a UI unless the skip itself is recorded.
`orchestrator.ts` logs every skip with a reason (`ToolExecutionRecord`), so
the Investigation Control Room can show "URL Analysis: skipped — no URLs
found in email" as a real, auditable event, not silence.

Verified by `agent/orchestrator.test.ts`: tests assert tools are actually
absent from the tool log with status `skipped`, not present-but-empty.

## What the agent does NOT do (Rule 8)

- It never invents a Finding. Every `Finding` traces to a literal value:
  a regex match, a header's actual content, an HTTP response from a real
  API, a trained model's real probability output.
- It never sets the final risk score. `risk-engine/index.ts` computes that
  deterministically from the Findings the agent collected (Rule 9).
- No LLM is in this loop at all in the current build — explanations are
  template/data-driven (`riskAssessment.topReasons`, built directly from
  Finding.explanation strings). A real LLM could be added later strictly to
  phrase the *already-computed* findings/score in natural language, never
  to decide the score itself — see `docs/FINAL_STATUS.md` §8.

## Auditability

Every investigation returns a `toolLog: ToolExecutionRecord[]` — one entry
per tool, whether it ran, was skipped, or errored, with a real timestamp and
duration. Nothing about "why the agent did X" is hidden; it's exactly the
list of tools it called or didn't, and why.
