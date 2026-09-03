# NetraX

An agentic AI system for intelligent cyber-fraud detection and investigation — built for Smart India Hackathon (SIH).

## 1. Overview

NetraX lets an analyst paste a suspicious SMS, email, URL, phone number, or transaction and get back a clear, explainable risk assessment: a risk score, the specific evidence behind it, and safe next actions. Under the hood, an **agentic AI investigation system** — not a single chatbot prompt — classifies the input, decides which specialized tools are relevant, runs them, fuses their evidence deterministically, and only then explains the *already-computed* result in plain language.

The current build is a **frontend-only, premium SOC-style UI** running entirely on local mock data and a local rule-based "agent" engine — no LLM, ML service, or investigation backend is wired up yet (see [§4](#4-current-architecture) and [§9 Limitations](#9-limitations)). Sign-in is real (Supabase Auth), everything past the login screen is local/mock.

## 2. Features

- **Investigate**: type-aware input (Message / Email / URL / Phone / Transaction), a live animated multi-stage investigation (agent orb, pipeline stepper, per-tool execution panel), then a full result view — risk gauge, evidence breakdown, plain-language explanation, and a recommended-action panel with real Mark Reviewed / Report / Save Case actions.
- **Agent Control Room**: an interactive node diagram of the actual agent architecture (Fraud Agent → 4 analyzer tools → Evidence Fusion → Risk Engine → Assessment) with a live, timestamped, auditable event stream — no hidden chain-of-thought is ever shown.
- **Cases / Case Details / Alerts**: searchable, filterable case list and alert center backed by a shared local store; case actions (resolve, false positive, review, save, watch) persist across the session via `localStorage`.
- **Analytics / Model Performance**: Recharts dashboards (trend, category mix, risk distribution, tool usage) plus demo ML metrics (precision/recall/F1/ROC-AUC/confusion matrix) — accuracy is deliberately not the headline metric, since fraud data is imbalanced.
- **Threat Intelligence**: a searchable local knowledge base of indicator types (URL/Domain/Phone/Pattern/Scam Type), clearly labeled as demo data.
- Command palette (`⌘K` / `Ctrl+K`), `N` to jump to Investigate, collapsible sidebar, mobile bottom nav, dark-first glass UI.

## 3. Why agentic, not a chatbot

- **Why AI?** It turns unstructured, free-text messages into a plain-language explanation.
- **Why ML (eventually)?** Quantitative, trained fraud/anomaly scores instead of hand-waving — today this is simulated by a transparent, deterministic rule-based scorer with the same shape a trained model would have.
- **Why agentic?** The orchestrator decides *which* tools a given input needs and only runs those (an SMS with a URL triggers different tools than a raw transaction) — visible live in both the Investigate page and the Agent Control Room.
- **Why not a simple chatbot?** The agent performs a multi-step investigation over structured evidence with a deterministic risk score and a full audit trail, not a single free-form reply.

## 4. Current architecture

```
frontend/src/
  lib/mock/
    analyzers.ts     deterministic heuristics: message / URL / scam-pattern / transaction analyzers + risk fusion
    engine.ts         orchestrator — dynamic tool selection, simulated async pipeline, builds the final case
    explain.ts        template-based explanation + recommendation generation (never invents evidence)
    store.ts          shared case store (pub-sub + localStorage), the "database" for this build
    seed-cases.ts, threat-intel.ts, model-metrics.ts, notifications.ts, trend-data.ts   demo datasets
  components/app/      reusable domain UI: MetricCard, RiskGauge, EvidenceCard, ToolStatusRow,
                        PipelineStepper, AgentOrb, AgentNode, CaseRow, AlertCard, CommandPalette, …
  components/ui/       shadcn/ui primitives (hand-written — the shadcn CDN isn't reachable in this environment)
  pages/               one file per route
```

`runInvestigation()` in `engine.ts` is the seam meant for a real backend later: swap its internals for calls to a real Message/URL/Transaction analyzer service, a real ML risk model, and an LLM explanation call, without changing any page component — they only depend on the `FraudCase` / `ToolExecution` / `PipelineStage` shapes in `types/fraud.ts`.

## 5. Tech stack

- React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (hand-written), Framer Motion, Recharts, lucide-react, cmdk
- Supabase Auth for sign-in/sign-up (real — `frontend/src/lib/auth.tsx`, `lib/supabase.ts`)
- Everything else (cases, alerts, analytics, threat intel, model metrics) is local mock data/state — see §4

## 6. Local setup

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:5173`. You'll land on `/login` — sign up for an account (Supabase sends a confirmation email) or sign in, then you're into the app. All app data below the auth wall is local to your browser session (`localStorage`), not shared with other users.

`frontend/.env` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` for auth to work — copy `.env.example` at the repo root and fill them in from your Supabase project settings if `.env` isn't already present.

## 7. Demo script

1. **Investigate** → click "Try phishing SMS" → Start AI Investigation → watch the pipeline animate → see the 94%+ HIGH RISK result with evidence and recommendations.
2. **Agent Control Room** → Run Demo Investigation → watch the node diagram light up and the event stream fill in live.
3. **Cases** → open the case you just created → try Mark Resolved / Save Case → see it reflected on **Saved Cases** / **My Investigations**.
4. **Analytics** and **Model Performance** for the judge-facing metrics view.

## 8. Environment variables

See `.env.example` at the repo root:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
GEMINI_API_KEY=
```

`GEMINI_API_KEY` is unused by the current frontend-only build — it's reserved for when `engine.ts`'s explanation step is swapped for a real Gemini call server-side (never call Gemini directly from the browser with this key).

## 9. Limitations

This is an SIH hackathon prototype, not a production security product:
- No real ML model, LLM, or investigation backend is connected yet — `runInvestigation()` is a transparent, local, rule-based simulation, clearly labeled as demo data throughout the UI.
- Case/alert/analytics data lives in browser `localStorage`, not a shared database — it resets if you clear site data and isn't visible across devices or users.
- It is **not** a substitute for official cybercrime reporting (e.g. cybercrime.gov.in) or your bank's fraud-reporting channels.
- Never paste passwords, OTPs, bank credentials, or private keys into the investigation input.
