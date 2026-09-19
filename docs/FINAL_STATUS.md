# Final Status — NetraX / FraudShield AI (SIH26106)

Last updated: 2026-09-07. This document is the honest, single source of
truth for what was actually built, actually tested, and actually still
missing. Where something is incomplete, it says so — per this project's
own Rule 1 ("do not fake anything"), that rule applies to this report too.

## 1. What SIH26106 actually is

Problem Statement SIH26106: **"AI-Powered Email Threat Detection,
GeoLocation and Forensic Intelligence Platform"** (AICTE Cyber Security
Cell). This repo already contained a working prototype called **NetraX**
for a *different* problem (SMS/URL/transaction fraud) — Phase 0
(`docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_PLAN.md`) inspected that
repo, and the user confirmed (2026-09-06): archive the SMS/transaction
modules (code kept, dropped from active UI), keep NetraX as the product
name, keep URL analysis (in-scope), and build the email-forensics platform
as the new primary product.

## 2. Completed phases

| Phase | What was built | Verified how |
|---|---|---|
| 0 — Inspection & planning | `docs/CURRENT_STATE.md`, `docs/IMPLEMENTATION_PLAN.md` | Direct repo inspection |
| 1 — Dataset acquisition | `scripts/data/download_datasets.py`, real downloads of Enron (443MB), SpamAssassin (9 files), URLhaus snapshot; UCI Phishing reused | Real HTTP downloads, checksums recorded in each `data/raw/*/metadata.json` |
| 2 — Data profiling | `scripts/validation/profile_datasets.py` → `reports/data_quality_report.md` + `.json` | Computed from real files, not estimated |
| 3 — Email parser | `supabase/functions/_shared/email/` (MIME, HTML-to-text, indicator extraction) | 38 unit tests + validated against real SpamAssassin corpus emails (found & fixed 2 real bugs) |
| 4 — Header forensics | `supabase/functions/_shared/email/forensics/` (SPF/DKIM/DMARC, spoofing, homoglyphs, Received-chain, timestamps, relay patterns) | 43 unit tests + validated against 8 real corpus emails (found & fixed a real false-positive: short-domain typosquat collision) |
| 5 — URL/domain analysis | `supabase/functions/_shared/url-analysis/` | 18 unit tests + validated against real URLhaus malicious URLs |
| 6 — Threat intelligence | `supabase/functions/_shared/threat-intel/` (PhishTank, URLhaus adapters) | 16 unit tests; live API behavior verified (see §5 credentials) |
| 7 — IP/ASN/geolocation | `supabase/functions/_shared/geolocation/` (real CIDR classification + MaxMind client) | 19 unit tests, including CIDR boundary edge cases |
| 8-9 — ML pipeline | `ml/src/train_email.py` — real model trained on SpamAssassin | Real metrics: F1=0.961, ROC-AUC=0.998 on held-out test set; 34 pytest tests |
| 10 — Agentic orchestration | `supabase/functions/_shared/agent/orchestrator.ts` — dynamic tool selection | 9 unit tests confirming tools are actually skipped, not called-and-ignored, when irrelevant |
| 11 — Risk engine | `supabase/functions/_shared/risk-engine/` — deterministic, capped-per-source scoring | 10 unit tests including per-source cap verification |
| 12-13 — Evidence fusion & graph | `supabase/functions/_shared/evidence-graph/` | 5 unit tests |
| 14-15 — Case management & DB schema | `supabase/archive/20260906120000_email_forensics_schema.sql` (14 tables, RLS) | Written and reviewed; **not applied to a live database** — see §5 |
| 16-19 — Frontend | Investigate page wired to the real backend; Evidence Graph view (case detail + result view); risk levels extended to include CRITICAL | TypeScript build clean, Vite compiles all changed modules, backend verified end-to-end via curl; **no pixel-level screenshot** — see §5 |
| 21 — Demo data | `data/demo/` — 8 synthetic email cases | Run through the real pipeline; results in `reports/demo_validation.md` |

**Total automated tests passing: 169 TypeScript (Node's built-in runner) +
34 Python (pytest) = 203.**

## 3. What's real vs. what's demonstration

Per Rule 7 (never mix these):

- **Real, trained ML**: SMS classifier (archived), URL phishing classifier
  (F1 reported in `docs/ml/`), email content classifier (F1=0.961,
  ROC-AUC=0.998) — all three trained on real public datasets with real,
  measured metrics, no fabricated numbers.
- **Real, deterministic rule-based forensics**: header analysis, URL
  structural analysis, IP classification — pure functions, fully unit
  tested, validated against real-world email samples.
- **Real live threat intelligence** (when credentials are configured):
  PhishTank, URLhaus — adapters built against their documented API
  contracts.
- **Demonstration data, clearly labeled**: `data/demo/*.eml` — synthetic
  emails used to exercise the real pipeline, never presented as live
  threat intelligence.

## 4. Datasets obtained vs. unavailable

| Dataset | Status |
|---|---|
| CMU Enron | ✅ Downloaded (443MB, checksum verified) |
| Apache SpamAssassin | ✅ Downloaded (9 files) |
| UCI Phishing Websites | ✅ Reused from earlier NetraX build |
| URLhaus (bulk CSV snapshot) | ✅ Downloaded, no key needed |
| PhishTank bulk data | ❌ Requires `PHISHTANK_APP_KEY` — not available in this environment |
| MaxMind GeoLite2 | ❌ Requires `MAXMIND_ACCOUNT_ID` + `MAXMIND_LICENSE_KEY` — not available |

Both adapters are fully implemented against their documented API contracts
and gracefully report "unavailable" (never a fabricated match/location)
without credentials — see `docs/DATA_SOURCES.md`.

## 5. Known limitations / what's genuinely incomplete

Being direct about this rather than burying it:

1. **Supabase schema is written, not applied.** The Supabase MCP tool
   available in this session is connected to a different project
   (`gbxlfbqqasxzqsrqfkfp`, "Label Check") than the one configured in
   `frontend/.env` (`vfjgavbbrqsrtqiirjnv`), and no Docker/Supabase CLI is
   installed locally. The migration SQL is complete and reviewed but has
   never run against a live database. **To apply it**: reconnect the
   Supabase tool to the correct project and use `apply_migration`, or run
   `supabase db push` locally with the CLI, or paste the file into the
   Supabase SQL editor.
2. **Edge Functions are written for Deno but never deployed/run as Deno.**
   No Deno CLI or Docker is available in this environment. Every Edge
   Function in `supabase/functions/*/index.ts` is a thin wrapper around
   portable TypeScript in `supabase/functions/_shared/` that has zero
   Deno-specific code (proven by running the entire test suite under
   Node). `server/local-api.ts` serves that same shared logic over HTTP
   using only Node's built-in `http` module, so the app is fully
   functional locally today — but the "real" Edge Functions have not
   themselves been executed by a Deno runtime in this session. Deploying
   them to a correctly-connected Supabase project is a deployment-target
   change, not a rewrite.
3. **No pixel-level browser screenshot of the frontend.** No working
   headless-browser tool was available (`chromium-cli` absent; Playwright's
   Chromium download timed out repeatedly against `cdn.playwright.dev`,
   unlike every dataset/API host used elsewhere in this build, which
   downloaded/responded normally). Verified instead via: a clean
   `tsc -b --noEmit` build, Vite successfully compiling every changed
   module (confirmed via direct HTTP requests to the dev server), and the
   backend producing correct real results for the exact same request shape
   the frontend sends.
4. **Frontend coverage is real but not exhaustive.** The Investigate page
   and case detail page are fully wired to the real backend, including a
   working Evidence Graph visualization. Dedicated standalone pages for
   "Email Forensics" and "Reports" as separate routes (as opposed to
   sections within Investigate/Case Detail) were not built separately —
   time was prioritized on making the core investigation flow completely
   real end-to-end over adding more routes that would show the same
   underlying data differently.
5. **A real, documented detection gap** (not a bug, a genuine limitation):
   leetspeak character substitution in domains (e.g. `micr0soft.com`) is
   not caught by the current homoglyph/typosquat checks, which handle true
   Unicode confusables and small-edit-distance typos but not this specific
   pattern — see `reports/demo_validation.md` for the case that surfaced
   this.
6. **Testing/security/offline-mode/performance (Phases 22-25)** were
   exercised incidentally throughout (every module has real unit tests;
   every external dependency has a verified graceful-degradation path) but
   were not run as a separate, dedicated formal pass (e.g. no dedicated
   load-testing, no formal SSRF penetration test beyond "this code never
   fetches a URL the user didn't submit for its own metadata").
7. **Automation scripts (Phase 28)** exist for data acquisition/profiling/
   training but not yet as unified `npm run` commands wrapping the whole
   pipeline — see §7 for the actual commands to run each piece.

## 6. Environment variables required

See `.env.example` at the repo root for the full list with explanations.
Summary: `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (auth), `GEMINI_API_KEY`
(unused — no LLM wired in this build, template-based explanations only, per
the mock/template `LLMAdapter` design decision), `PHISHTANK_APP_KEY`,
`URLHAUS_AUTH_KEY`, `MAXMIND_ACCOUNT_ID`/`MAXMIND_LICENSE_KEY` (all three
optional — features degrade gracefully without them), `ML_API_URL` /
`VITE_LOCAL_API_URL` (point at the local dev servers below).

## 7. Exact commands to run this project

```bash
# 1. Frontend
cd frontend && npm install && npm run dev        # http://localhost:5173

# 2. ML inference API (email/URL/SMS model serving)
cd ml
./.venv/Scripts/python.exe -m pip install -r requirements-ml.txt
./.venv/Scripts/python.exe -m uvicorn api.server:app --port 8000

# 3. Local investigation API (parser/forensics/URL/threat-intel/geo/agent/risk-engine)
node server/local-api.ts                          # http://localhost:8787

# 4. Retrain ML models (optional — models are already trained/committed)
cd ml && ./.venv/Scripts/python.exe train.py
./.venv/Scripts/python.exe -m pytest tests/ -v     # 34 tests

# 5. Backend TypeScript test suite
cd supabase/functions/_shared
node --test ml/*.test.ts email/*.test.ts email/forensics/*.test.ts \
  url-analysis/*.test.ts threat-intel/*.test.ts geolocation/*.test.ts \
  agent/*.test.ts risk-engine/*.test.ts evidence-graph/*.test.ts   # 169 tests

# 6. Re-acquire/re-profile datasets (optional — already done)
python scripts/data/download_datasets.py
python scripts/validation/profile_datasets.py
```

## 8. Remaining optional improvements

- Reconnect Supabase MCP to the correct project (or provide CLI/Docker) and
  apply the schema for real, then wire case persistence to it instead of
  `localStorage`.
- Obtain PhishTank/MaxMind credentials to enable live threat intel and
  geolocation.
- Build dedicated Threat Intelligence / Reports routes surfacing the same
  data currently shown inline.
- Wire a real LLM (Gemini) behind the existing `LLMAdapter` seam for
  natural-language explanation generation, strictly bounded to explaining
  the already-computed deterministic score (Rule 8/9).
- Add the leetspeak-domain detection case to the homoglyph checker.
- Formal load/performance testing and an SSRF-focused security review pass.
