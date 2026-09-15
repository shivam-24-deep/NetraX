# Investigation Flow

End-to-end trace of what actually happens between "evidence arrives" and "a
case exists with a real, explainable result" — covering both entry points
(manual Investigate page, and mobile/web Send-to-NetraX) since they now
converge on the exact same pipeline.

```
                    ┌─────────────────┐        ┌──────────────────┐
                    │  Investigate     │        │  Send to NetraX   │
                    │  page (manual    │        │  (paste/upload/   │
                    │  type selection) │        │  phone share)     │
                    └────────┬─────────┘        └─────────┬─────────┘
                             │                             │
                             │                  classifyInput() — deterministic
                             │                  EMAIL / URL / MESSAGE / TRANSACTION / UNKNOWN
                             │                             │
                             ▼                             ▼
                    ┌─────────────────────────────────────────────┐
                    │  runEmailInvestigation()  runUrlInvestigation() │
                    │  frontend/src/lib/mock/engine.ts               │
                    └───────────────────────┬─────────────────────┘
                                             │ POST /investigate-email
                                             │ POST /investigate-url
                                             ▼
                    ┌─────────────────────────────────────────────┐
                    │  server/local-api.ts (Node)                    │
                    │  → supabase/functions/_shared/agent/           │
                    │    orchestrator.ts (investigateEmail)          │
                    │    investigate-url.ts (investigateUrl)         │
                    └───────────────────────┬─────────────────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────┐
              ▼                              ▼                              ▼
      email/parser.ts               url-analysis/index.ts          threat-intel/index.ts
      email/forensics/                (structural + ML)              (PhishTank, URLhaus)
      (SPF/DKIM/DMARC,                                                       │
       homoglyph, Received-chain)            │                               │
              │                              └───────────────┬───────────────┘
              ▼                                              ▼
      ml/client.ts (content model)              geolocation/index.ts (email path only —
                                                  public IPs from Received chain)
              │                                              │
              └──────────────────┬───────────────────────────┘
                                  ▼
                    risk-engine/index.ts — computeRiskScore()
                    deterministic, per-source-capped, 0–100
                                  │
                                  ▼
                    evidence-graph/builder.ts
                    buildEvidenceGraph() (email) / buildUrlEvidenceGraph() (URL)
                                  │
                                  ▼
                    toolLog: ToolExecutionRecord[] — every call/skip, auditable
                                  │
                                  ▼
              ┌───────────────────────────────────────────┐
              │  Case creation (client-side, always)         │
              │  frontend/src/lib/case-id.ts                 │
              │  sha256Hex() → findCaseByEmailHash()          │
              │  idempotency: same content never double-cases │
              │  addCase() → localStorage (netrax.cases.v1)   │
              └───────────────────┬───────────────────────┘
                                  ▼
              /cases/:id — case detail, PDF, evidence ZIP,
              Cyber Cell demo package, dashboard "Recent
              Investigations" (tagged with its source: Mobile
              Share / Web Upload / Manual Input)
```

## Key property: one pipeline, two entry points

`runEmailInvestigation` and `runUrlInvestigation`
(`frontend/src/lib/mock/engine.ts`) are each called from exactly two places —
`investigate.tsx` (user picks the type manually) and
`lib/ingest/ingest-service.ts` (type is auto-classified). Neither entry point
has its own copy of the investigation logic, the case model, the ID
generation, or the idempotency check. The only thing mobile/web ingestion
adds on top is:

1. `lib/ingest/classify.ts` — decides which of the two pipelines to call (or
   neither, honestly, for MESSAGE/TRANSACTION/UNKNOWN — see
   `docs/mobile-ingestion.md` §1).
2. A `source` tag (`mobile_share` / `web_upload` / `manual`) attached to the
   resulting case, purely for display (dashboard/cases list badge) — it does
   not change how the case was investigated.

## Stages, concretely

| Stage | What actually runs | Real or paced-for-display? |
| --- | --- | --- |
| Evidence received | Paste/upload/share arrives at `send.tsx` or `investigate.tsx` | Real |
| Input classified | `classifyInput()` (mobile path) or the user's manual tab choice | Real |
| Tools selected | The agent orchestrator decides which of header-forensics/URL-analysis/threat-intel/geolocation actually apply — see `docs/AGENT_ARCHITECTURE.md` | Real, logged in `toolLog` |
| Evidence collection | Each selected tool actually runs against the real submitted content | Real |
| Risk calculated | `computeRiskScore()` — deterministic formula, see `docs/RISK_SCORING.md` | Real |
| Case generated | `case-id.ts` generates `NX-YYYY-MMDD-XXXXXX` / `NTX-XXXX-XXXX-XXXX`, case is stored | Real |

The only non-real part of this flow is the *pacing* of the UI reveal — small
`wait()` calls in `engine.ts` space out when each already-computed stage
shows up on screen, purely so the Control Room reads as a live investigation
instead of a single instant JSON dump. Every value shown (duration, finding,
status) is the real measured one from the backend call, never a fabricated
placeholder — see the comment block above `runEmailInvestigation` in
`engine.ts`.

## Where this diverges from a literal reading of the original spec

- There is no separate backend "ingestion" endpoint that creates a case and
  hands back a `case_id` — case creation is (and was, before mobile ingestion
  existed) a client-side step, because case storage itself is
  `localStorage`-based, not a live database (see `docs/mobile-ingestion.md`
  and `docs/FINAL_STATUS.md`). Building a server-side case-creation endpoint
  on top of that would mean two different ID authorities for the same case —
  so `ingest-service.ts` calls the same client-side case-creation code the
  manual flow already used, rather than inventing a second one.
- MESSAGE and TRANSACTION inputs are classified correctly but not
  automatically investigated — there is no real (non-mock) pipeline for them
  yet, and routing them through the archived mock analyzers under NetraX's
  "real investigation" banner would misrepresent what actually ran.
