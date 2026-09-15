# Current State (as of 2026-09-06)

This document is Phase 0 of the FraudShield AI / SIH26106 build. It records what
actually exists in this repository today, verified by direct inspection (not
assumed from prior specs or chat history). Everything below was true at
inspection time; re-verify before relying on it in a future session.

## 1. What this repo actually is right now

The repo currently contains a **complete, working SIH prototype called
"NetraX"** — an agentic fraud-investigation MVP for a *different* problem
shape than SIH26106: it investigates free-text **SMS / URL / phone /
transaction** input, not email. It is not a mockup — it has real trained ML
models, a real inference API, and a real (if minimal) auth layer.

The product name and pitch decks in `ppt/` show the project was originally
called "FraudShield AI" and was renamed to "NetraX" at some point
(`ppt/FraudShield_AI_SIH_2026*.pptx/pdf` and `ppt/NetraX_SIH_2026_FINAL.*`
both exist). The current README (`README.md`) documents NetraX as the live
product name.

**Important scope note:** SIH26106's official title is *"AI-Powered Email
Threat Detection, GeoLocation and Forensic Intelligence Platform"* — email
forensics is the primary product, with URL/domain/IP/geolocation as
supporting investigation capability. NetraX's current primary domain (SMS +
transaction fraud) is **not** part of SIH26106's scope. Whether the SMS/
transaction modules should be retired, kept as a secondary module, or removed
entirely is a product decision this document does not make — see
`IMPLEMENTATION_PLAN.md` §Open Decisions.

## 2. Repository layout

```
frontend/     Vite + React 19 + TypeScript + Tailwind v4 SPA (see §3)
ml/           Python ML pipeline: SMS spam, URL phishing, transaction fraud
              models — trained, with real metrics (see §4)
supabase/     migrations/ and functions/ directories exist but are EMPTY
              (no schema, no edge functions deployed yet)
docs/         ml/ subfolder has real dataset/training/model-selection reports
              + generated figures for the 3 existing models
ppt/          pitch decks (pptx/pdf) for NetraX and earlier FraudShield AI
              branding — not part of the running application
.env.example  Supabase URL/anon key, VITE_SKIP_AUTH, VITE_ML_API_URL,
              GEMINI_API_KEY (present as empty placeholder, unused by code)
```

No root-level `package.json` — the frontend is the only Node project, in
`frontend/`. There is no Node/Express backend; the only backend-like process
is the Python FastAPI ML inference service in `ml/api/server.py`.

## 3. Frontend (`frontend/`)

- **Stack**: React 19, TypeScript, Vite 8, Tailwind CSS v4, hand-written
  shadcn/ui-style primitives (the shadcn CDN isn't reachable in this
  sandbox), Framer Motion, Recharts, lucide-react, cmdk, react-router-dom 7.
- **Scripts**: `npm run dev`, `npm run build` (`tsc -b && vite build`),
  `npm run lint` (oxlint), `npm run preview`. No test script/framework wired
  up yet (no vitest/jest present in devDependencies).
- **Auth**: real Supabase Auth (`@supabase/supabase-js`), sign-up/sign-in
  pages exist (`login.tsx`, `signup.tsx`); `VITE_SKIP_AUTH` escape hatch for
  local dev. Requires a real Supabase project's URL/anon key in
  `frontend/.env` (not committed).
- **Pages** (`src/pages/`, 16 files): `dashboard`, `investigate`,
  `agent-control-room`, `cases`, `case-detail`, `alerts`,
  `threat-intelligence`, `analytics`, `model-performance`,
  `my-investigations`, `saved-cases`, `watchlist`, `settings`, `login`,
  `signup`, `not-found`.
- **Domain logic is entirely client-side mock/local** (`src/lib/mock/`):
  - `analyzers.ts` — deterministic rule-based heuristics for message/URL/
    scam-pattern/transaction analysis + risk fusion math.
  - `engine.ts` — the "agent" orchestrator: dynamic tool selection, a
    simulated async investigation pipeline, builds the final case object.
  - `ml-client.ts` (new, untracked) — calls the local FastAPI ML service;
    no-ops silently if it isn't running.
  - `real-model-metrics.ts` (new, untracked) — real trained-model metrics
    for display, replacing a deleted `model-metrics.ts` mock file.
  - `explain.ts` — template-based explanation/recommendation text from
    structured evidence only (never invents evidence — same principle
    SIH26106 requires).
  - `store.ts` — pub-sub + `localStorage` "database" for cases/alerts.
    **There is no real database** — nothing here is shared across users or
    devices, and it all resets on `localStorage` clear.
  - `seed-cases.ts`, `threat-intel.ts`, `notifications.ts`, `trend-data.ts`
    — static demo data, explicitly labeled as such in the UI.
- **Reusable UI components** (`src/components/app/`, 15 files) map well onto
  SIH26106's needed screens even though the domain data differs:
  `risk-gauge`, `evidence-card`, `pipeline-stepper`, `agent-orb`,
  `agent-node`, `tool-status`, `investigation-timeline`, `metric-card`,
  `chart-card`, `case-row`, `alert-card`, `command-palette`,
  `risk-breakdown`, `status-indicator`, `empty-state`.
- **Uncommitted work in progress** (`git status`): `engine.ts`,
  `analytics.tsx`, `model-performance.tsx` were being modified, and
  `model-metrics.ts` replaced by `real-model-metrics.ts` + `ml-client.ts` —
  this looks like an in-flight effort to wire real trained-model metrics
  into the Analytics/Model Performance pages, not yet finished/committed.

## 4. ML pipeline (`ml/`)

Real, reproducible, already trained — not placeholders:

- `ml/data/`: `SMSSpamCollection` (UCI SMS Spam), `Training Dataset.arff`
  (UCI Phishing Websites — **this is the same dataset SIH26106 Phase 5
  calls for**, already downloaded), `creditcard.csv` (Kaggle/ULB credit
  card fraud, gitignored — 150MB, not committed), `Phishing Websites
  Features.docx` (feature documentation), `readme`.
- `ml/src/`: `data_loader.py`, `preprocessing.py`, `train_sms.py`,
  `train_url.py`, `train_transaction.py`, `evaluation.py`,
  `model_registry.py`, `inference.py`.
- `ml/train.py`: single entry point, trains + evaluates + saves all three
  models.
- `ml/models/`: `sms_pipeline.joblib`, `url_pipeline.joblib`,
  `transaction_pipeline.joblib`, `model_metadata.json` — real trained
  artifacts with real metrics already committed.
- `ml/api/server.py`: FastAPI service — `POST /analyze`, `GET /models`,
  `GET /health`. Frontend calls it optionally; falls back to rule-based-only
  evidence if unreachable (documented, honest degraded-mode behavior —
  matches SIH26106 Phase 24's requirement).
- `ml/tests/test_pipeline.py`: pytest suite (README claims 26 tests
  covering dataset loading, inference validity, error handling — not
  re-run as part of this inspection).
- `ml/.venv/`: a populated virtualenv is present in the working tree
  (should be gitignored if not already — verify).
- **Directly reusable for SIH26106**: the URL phishing model + UCI Phishing
  dataset (Phase 5). **Not part of SIH26106 scope**: SMS spam and
  transaction fraud models — these solve a different problem statement.

`docs/ml/` already has `DATASET_REPORT.md`, `MODEL_SELECTION.md`,
`TRAINING_REPORT.md`, and 18 generated figures (confusion matrices, ROC/PR
curves, feature importance, class distribution) for the 3 existing models —
real, not fabricated, per those reports' own methodology sections.

## 5. Supabase (`supabase/`)

`migrations/` and `functions/` directories exist but are **completely
empty** — no schema has been created, no edge functions deployed. Despite
the README calling auth "real," only Supabase's built-in Auth product is in
use; there is no application database yet. All of SIH26106's required
tables (Phase 15: `profiles`, `email_cases`, `email_headers`, `evidence`,
`evidence_edges`, `indicators`, `threat_intel_results`,
`infrastructure_entities`, `geo_enrichment`, `alerts`, `feedback`,
`model_metrics`, `tool_logs`, etc.) need to be designed and migrated from
scratch.

## 6. What SIH26106 needs that does not exist yet at all

- Email parsing (.eml/MIME/pasted/JSON), header forensics engine (SPF/DKIM/
  DMARC, Received-chain, spoofing/lookalike/homoglyph detection).
- Threat intelligence adapters (PhishTank, URLhaus) — normalized provider
  interface.
- IP/ASN/geolocation enrichment (MaxMind GeoLite) with private/reserved IP
  filtering.
- Evidence graph (nodes/edges: Email → Sender → Domain → IP → ASN →
  Country; Email → URL → Domain → ThreatIntel).
- Case management workflow with real statuses, analyst human-in-the-loop
  actions, feedback storage.
- Forensic report generation.
- Real Supabase schema + RLS.
- Dataset acquisition for Enron corpus, SpamAssassin corpus, PhishTank,
  URLhaus, MaxMind GeoLite — none currently downloaded.
- A backend API layer for business logic (email parsing/forensics/agent
  orchestration currently all happen only as client-side TS mock logic;
  there is no equivalent of `ml/api/server.py` for anything email-related).

## 7. Dependency / environment risks

- `ml/.venv/` appears to be a real, populated virtualenv sitting in the
  working tree — large, platform-specific; confirm `.gitignore` excludes it
  before any commit.
- `creditcard.csv` (150MB) is documented as gitignored and not committed —
  consistent with dataset-size rules, but irrelevant to SIH26106 anyway.
- No automated frontend test framework is wired up (no vitest/jest in
  `package.json`) despite SIH26106 Phase 22 requiring frontend test
  coverage.
- No CI configuration found in this inspection.
- `GEMINI_API_KEY` is defined in `.env.example` but not consumed by any
  code path yet (README confirms: "unused by the current frontend-only
  build").

## 8. Reuse vs. replace summary

| Keep / reuse as-is or with light changes | Replace / build new |
|---|---|
| Vite/React/TS/Tailwind frontend shell, routing, layout, sidebar, command palette | SMS spam classifier + dataset (out of SIH26106 scope) |
| Supabase Auth wiring (login/signup pages, `lib/auth.tsx`) | Transaction fraud classifier + dataset (out of scope) |
| `components/app/*` UI kit (risk-gauge, evidence-card, pipeline-stepper, agent-orb, investigation-timeline, etc.) | Client-side `localStorage` store → real Supabase schema + RLS |
| Agentic orchestration *pattern* in `engine.ts` (dynamic tool selection, simulated pipeline, deterministic evidence fusion) | Domain content of the orchestrator (email-specific tools instead of SMS/URL/transaction analyzers) |
| UCI Phishing Websites dataset + trained `url_pipeline.joblib` (Phase 5 of SIH26106 asks for exactly this) | Email parser, header forensics engine — net new |
| `ml/` pipeline scaffolding pattern (data_loader/preprocessing/train/evaluate/registry/inference + FastAPI serving) | Threat intel adapters, IP/ASN/geolocation — net new |
| Degraded-mode principle already proven (ML API optional, rule-based fallback) | Evidence graph, case management, report generation — net new |

See `docs/IMPLEMENTATION_PLAN.md` for the phased roadmap and the open
product decisions that should be confirmed before Phase 1 implementation
begins.
