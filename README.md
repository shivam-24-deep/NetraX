# NetraX

An agentic AI system for email threat detection and forensic intelligence —
built for Smart India Hackathon 2026, Problem Statement **SIH26106**:
*"AI-Powered Email Threat Detection, GeoLocation and Forensic Intelligence
Platform"* (AICTE Cyber Security Cell).

## 1. Overview

NetraX lets an analyst submit a suspicious email — raw `.eml`, pasted text,
or structured JSON — and get back a real, explainable forensic
investigation: a deterministic risk score (0-100), the specific evidence
behind it, an interactive evidence graph, and a recommended next action.
Under the hood, an **agentic investigation system** parses the email,
dynamically decides which downstream tools are actually relevant (no URL →
skip URL/threat-intel tools entirely; no public source IP → skip
geolocation entirely), runs them, and fuses their evidence deterministically
— an LLM is never in the loop for scoring, only (optionally, not yet wired)
for explaining an already-computed result.

This is not a mockup. Header forensics (SPF/DKIM/DMARC, spoofing,
homoglyph/typosquat domains, Received-chain analysis), URL structural
analysis, threat-intelligence lookups (PhishTank/URLhaus), IP geolocation
(MaxMind), and a real trained ML content classifier (F1=0.961 on held-out
SpamAssassin data) are all real, working code with **203 automated tests**
(169 TypeScript + 34 Python) — see `docs/FINAL_STATUS.md` for the complete,
honest account of what's built, tested, and still incomplete.

**Note on the name**: this repo was originally built as a general
SMS/URL/transaction fraud prototype (also called NetraX, briefly
"FraudShield AI") before being pivoted to SIH26106's email-forensics scope.
Those earlier modules are archived — code kept for reference, dropped from
the active UI. See `docs/CURRENT_STATE.md` and `docs/IMPLEMENTATION_PLAN.md`
for that history.

## 2. Features

- **Investigate**: submit a raw email, watch the real multi-tool
  investigation pipeline execute, then see a full result — risk score,
  evidence breakdown, an interactive evidence graph (Email → Sender/URL →
  Domain/Threat-Intel → IP → ASN → Country), and a recommended action.
- **Header forensics**: SPF/DKIM/DMARC results, display-name spoofing,
  Reply-To/Return-Path mismatches, homoglyph/punycode domain detection,
  typosquatting (Levenshtein-distance based), Received-chain parsing and
  timestamp-anomaly detection — every finding cites its literal evidence;
  absent headers say so explicitly, never guessed.
- **URL analysis**: structural phishing indicators (IP-as-hostname, `@`
  tricks, shorteners, encoding density, TLD reputation) plus the same
  homoglyph/typosquat checks applied to link domains.
- **Threat intelligence**: PhishTank and URLhaus adapters — "not found" is
  never reported as "safe," and an unreachable/unconfigured provider
  reports "unavailable," never a fabricated result.
- **Geolocation**: MaxMind-based IP→country/ASN lookup, restricted to
  public IPs only (real CIDR classification filters private/reserved/
  loopback addresses), always phrased as approximate infrastructure
  location, never an exact address.
- **Evidence Graph**: click any node (email, sender, domain, URL, IP, ASN,
  country, threat-intel match) to inspect its underlying evidence.
- Case detail pages, alerts, analytics, and command palette (`⌘K`/`Ctrl+K`)
  carried over from the earlier NetraX build.

## 3. Why agentic, not a chatbot

- **Why AI?** Turns unstructured email content into structured, explainable
  evidence.
- **Why ML?** The email content classifier is a real model trained on real
  data (SpamAssassin corpus) with real, measured metrics — not a simulated
  score.
- **Why agentic?** The orchestrator decides *which* tools a given email
  needs and only runs those, with every skip logged and auditable — see
  `docs/AGENT_ARCHITECTURE.md`.
- **Why deterministic scoring?** The risk score is computed by a documented,
  testable formula (`docs/RISK_SCORING.md`), never by an LLM guessing a
  number.

## 4. Architecture

```
frontend/                 React 19 + Vite + TS + Tailwind v4
  src/lib/mock/engine.ts    runEmailInvestigation() calls the real backend;
                             legacy SMS/URL/transaction mock analyzers kept,
                             archived from the active UI
  src/components/app/       evidence-graph-view.tsx (new), risk-gauge,
                             evidence-card, pipeline-stepper, etc. (reused)

supabase/functions/_shared/   the real investigation logic (Phases 3-13),
                               portable TypeScript with zero Deno-specific
                               code — proven by running its own test suite
                               (169 tests) under Node
  email/                      parser, MIME handling, indicator extraction
  email/forensics/            header forensics engine
  url-analysis/                URL structural + brand/homoglyph analysis
  threat-intel/                PhishTank + URLhaus adapters
  geolocation/                  IP classification + MaxMind client
  agent/orchestrator.ts         dynamic tool-selecting investigation agent
  risk-engine/                  deterministic 0-100 scoring
  evidence-graph/                nodes/edges builder

supabase/functions/*/index.ts   thin Deno.serve() wrappers around the above
                                 (written, not yet deployed — see docs/FINAL_STATUS.md)

server/local-api.ts        Node HTTP server exposing the SAME shared logic
                            — the actually-running local backend today,
                            since no Deno CLI/Docker is available here

ml/                        Python training pipeline (SMS[archived], URL,
                            transaction[archived], and the new email
                            content classifier), FastAPI inference service

supabase/migrations/        real Postgres schema + RLS (written, not yet
                             applied to a live database — see FINAL_STATUS.md)

data/, scripts/data/        real dataset acquisition (Enron, SpamAssassin,
                             URLhaus, UCI Phishing) with provenance metadata
```

## 5. Tech stack

- React 19, TypeScript, Vite, Tailwind CSS v4, hand-written shadcn/ui-style
  components, Framer Motion, Recharts, lucide-react, cmdk
- Supabase Auth for sign-in/sign-up
- Node.js (built-in `http`, zero dependencies) for the local investigation
  API — proven portable to Deno/Supabase Edge Functions
- Python (scikit-learn, FastAPI) for ML training and inference

## 6. Local setup

```bash
# 1. Frontend
cd frontend
npm install
npm run dev              # http://localhost:5173

# 2. ML inference API (separate terminal)
cd ml
python -m venv .venv
./.venv/Scripts/python.exe -m pip install -r requirements-ml.txt
./.venv/Scripts/python.exe -m uvicorn api.server:app --port 8000

# 3. Investigation API (separate terminal, repo root)
node server/local-api.ts    # http://localhost:8787
```

Then open `http://localhost:5173`. With `VITE_SKIP_AUTH=true` in
`frontend/.env` you land straight on the dashboard; otherwise sign up via
Supabase Auth first. Go to **Investigate**, pick **Email**, click one of the
quick examples (or paste a real `.eml`), and run a real investigation.

`frontend/.env` needs `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` (auth) —
copy `.env.example` if `.env` isn't present. See `.env.example` for the
optional threat-intel/geolocation credentials.

## 7. Demo script

1. **Investigate** → Email → "Try phishing email" → Start AI Investigation
   → watch the real pipeline run → see the risk score, evidence, and
   evidence graph for a genuinely-detected phishing case.
2. Try "Try normal email" → confirm it correctly scores LOW.
3. Open the resulting case from **Cases** to see the Evidence Graph again
   in the case-detail view.
4. `data/demo/` has 8 more synthetic scenarios (BEC, credential theft,
   malware link, incomplete headers, benign-with-URL) — see
   `data/demo/README.md` and `reports/demo_validation.md` for real,
   already-run results on each.

## 8. Environment variables

See `.env.example` at the repo root for the full, documented list.

## 9. Limitations

See `docs/LIMITATIONS.md` and `docs/FINAL_STATUS.md` for the complete,
honest account — including real detection gaps, what requires credentials
this environment doesn't have, and what's written but not yet deployed.

This is an SIH hackathon prototype, not a production security product. It
is **not** a substitute for official cybercrime reporting
(cybercrime.gov.in) or your organization's security team.

## 10. Web pitch presentation

A full-screen, keynote-style presentation deck for SIH judges lives at
`/pitch` (e.g. `http://localhost:5173/pitch` with the frontend dev server
running) — ten slides, one screen each, navigated with the mouse wheel,
arrow keys, space, or on-screen controls (never a scrolling page). Press
`f` or `p` for a distraction-free presentation mode. See
`docs/WEB_PITCH_PLAN.md` for the design/implementation approach and
`docs/WEB_PITCH_QA.md` for what was actually tested (including a real bug
found and fixed during QA).

## 11. Documentation index

`docs/CURRENT_STATE.md` · `docs/IMPLEMENTATION_PLAN.md` ·
`docs/DATA_SOURCES.md` · `docs/AGENT_ARCHITECTURE.md` ·
`docs/RISK_SCORING.md` · `docs/SECURITY.md` · `docs/LIMITATIONS.md` ·
`docs/DEPLOYMENT.md` · `docs/FINAL_STATUS.md` · `docs/WEB_PITCH_PLAN.md` ·
`docs/WEB_PITCH_QA.md`
