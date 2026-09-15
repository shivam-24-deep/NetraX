# Implementation Plan — FraudShield AI / SIH26106

Companion to `docs/CURRENT_STATE.md` (read that first). This lays out a
build order for the full SIH26106 spec ("AI-Powered Email Threat Detection,
GeoLocation and Forensic Intelligence Platform") given what already exists
in this repo (the NetraX SMS/URL/transaction prototype).

This is a **planning document only** — no implementation has started beyond
Phase 0 (this inspection). Per this project's established working style, each
phase below is built, run, and verified individually, with an explicit
check-in before the next phase starts — not chained automatically.

## Decisions (confirmed 2026-09-06)

1. **NetraX's existing SMS + transaction fraud modules** — **archived**: code
   and trained models stay in the repo for reference, but are removed from
   navigation/active use. The shipped product surfaces email forensics only.
   (URL analysis is the one exception — see Phase 5 — since it's directly
   in SIH26106's scope and already trained on the right dataset.)
2. **Backend architecture** — **split**: ML inference stays Python
   (`ml/api/server.py` pattern, extended for the new email classifier);
   email parsing/forensics/agent orchestration/threat-intel/geolocation are
   implemented as Supabase Edge Functions (Deno/TS) in the currently-empty
   `supabase/functions/`.
3. **Product name** — **NetraX** stays the shipped name; SIH26106
   positioning ("AI-Powered Email Threat Detection, GeoLocation and
   Forensic Intelligence Platform") is the new product description under
   that name.
4. **LLM provider** — build the full agent against a mock/template
   `LLMAdapter` (same principle as the existing `explain.ts`): it explains
   and orchestrates but never invents evidence or the score. Swapping in a
   real `GEMINI_API_KEY` later activates it with no other code changes.
5. **Credentialed data sources** — PhishTank, URLhaus, and MaxMind GeoLite
   all require registration/API keys/account IDs I cannot generate. Each
   adapter is built against its real API contract with `.env.example`
   entries and an explicit "unavailable" degraded-mode path (never a fake
   match) — live results require you to obtain and supply those
   credentials.

## Phase-by-phase roadmap

Numbering matches the original spec's mission-phase groupings where it maps
cleanly; some spec phases are merged where they naturally ship together.

**Phase 0 — Inspection & planning** ✅ done (this document + CURRENT_STATE.md)

**Phase 1 — Dataset acquisition**
`scripts/data/download_datasets.*`, `data/README.md`, `docs/DATA_SOURCES.md`.
Download/verify: Enron corpus, SpamAssassin corpus (UCI Phishing already
present in `ml/data/`, reused as-is). PhishTank/URLhaus/GeoLite need
credentials — adapters built regardless, live calls gated on
`.env` keys being present.

**Phase 2 — Data profiling**
`reports/data_quality_report.md`, `reports/data_quality.json` for every
dataset acquired in Phase 1, plus a fresh profile of the already-present UCI
Phishing set.

**Phase 3 — Email parser**
`.eml`/MIME/pasted/JSON parsing, header + body + indicator extraction. Pure,
testable, no network calls, no attachment execution.

**Phase 4 — Email forensics engine**
Sender/display-name spoofing, Reply-To/Return-Path mismatch, domain
lookalike/homoglyph detection, Received-chain + SPF/DKIM/DMARC analysis.
Every finding carries evidence + confidence; absent headers are reported as
absent, never assumed.

**Phase 5 — URL/domain analysis + phishing model**
Reuse the existing UCI-trained `url_pipeline.joblib` and retrain/validate it
against the current feature spec if needed; add the additional URL features
the spec calls for (punycode, homoglyph, brand-similarity, shortener
detection) on top of what's already implemented.

**Phase 6 — Threat intelligence adapters**
`ThreatIntelProvider` interface, `PhishTankProvider`, `URLhausProvider`,
normalized response shape, explicit "not found" vs. "unavailable" states
(never "safe").

**Phase 7 — IP/ASN/geolocation**
Public-IP extraction from headers (private/reserved/localhost filtered),
MaxMind GeoLite lookups, "approximate infrastructure geolocation" framing
throughout — never exact attacker location.

**Phase 8–9 — ML pipeline & training for email classification**
New `ml/` additions: SpamAssassin-based email classifier (reusing the
existing `ml/src` scaffolding pattern: data_loader → preprocessing →
train → evaluate → registry → inference), real metrics, no fabricated
numbers, explicit false-positive/false-negative discussion since this is a
detection problem, not an accuracy-maximization one.

**Phase 10 — Agentic investigation workflow**
New orchestrator (successor to `engine.ts`'s pattern) that conditionally
calls only the tools relevant to a given email (no URL → skip URL/threat
intel tools; no public IP → skip geolocation) and produces an auditable
tool-execution trace, matching the existing Agent Control Room UI pattern.

**Phase 11–12 — Risk engine & evidence fusion**
Deterministic 0–100 scoring from ML + header anomalies + auth failures +
URL risk + threat intel + infra intel + language signals — LLM never sets
the score, only explains it. Normalized evidence model with typed evidence
items.

**Phase 13 — Evidence graph**
Interactive graph UI (Email → Sender → Domain → IP → ASN → Country; Email →
URL → Domain → ThreatIntel), click-to-inspect nodes.

**Phase 14–15 — Case management & database**
Real Supabase schema + migrations (currently empty) + RLS: `profiles`,
`email_cases`, `email_headers`, `investigation_events`, `analysis_results`,
`evidence`, `evidence_edges`, `indicators`, `threat_intel_results`,
`infrastructure_entities`, `geo_enrichment`, `alerts`, `feedback`,
`model_metrics`, `tool_logs`.

**Phase 16–19 — Frontend**
Reuse the existing shell, auth, and `components/app/*` UI kit; add/adapt
pages for Email Forensics, Threat Intelligence, Evidence Graph, the
Investigation Control Room hero screen, human-in-the-loop review actions.

**Phase 20–21 — Reports & demo data**
Forensic report generator; 8 synthetic demo email cases, clearly labeled
`DEMO DATA`.

**Phase 22–25 — Testing, security, offline mode, performance**
Test coverage for every adapter/engine listed in the spec; wire up a
frontend test runner (none exists today); SSRF protection for any URL
inspection; verified degraded-mode behavior for every external dependency.

**Phase 26–29 — Documentation, environment, automation, final validation**
Full `docs/*.md` set, `.env.example` completed, `scripts/` automation,
end-to-end acceptance run per the spec's Final Acceptance Test, and
`docs/FINAL_STATUS.md`.

## Next step

Decisions above are locked in. Waiting on explicit go-ahead to start Phase 1
(dataset acquisition) — per this project's working style, phases are built
and verified one at a time rather than chained automatically.
