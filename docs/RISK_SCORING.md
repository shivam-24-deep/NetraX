# Risk Scoring Methodology

Implemented in `supabase/functions/_shared/risk-engine/index.ts` (10 unit
tests). This document is the same explanation the UI shows for "why this
score exists" (Rule 9: an LLM never sets or adjusts this score).

## The four inputs

1. Every `Finding` collected during an investigation has a `severity`:
   `info` (0 pts), `low` (3 pts), `medium` (8 pts), `high` (15 pts),
   `critical` (25 pts).
2. Findings are grouped by their `source` (which analysis category
   produced them: sender analysis, authentication, URL analysis, threat
   intelligence, the ML content model, geolocation, etc.)
3. Each source's points are summed, then **capped** at that source's
   ceiling — this is the key design choice.
4. Capped per-source totals are summed and clamped to `[0, 100]`.

## Why per-source caps

Without a cap, an email with many *weak* signals from one source (say, ten
low-severity URL quirks) could mathematically out-score an email with one
*severe* signal from another source, which is backwards — five URL
oddities is weaker evidence than one confirmed threat-intel match. Capping
each source means one noisy category can't dominate, while genuinely severe
individual findings (`critical`, 25 points) still move the score a lot on
their own.

Ceilings, ranked by how strong an independent signal that category is:

| Source | Cap | Rationale |
|---|---|---|
| Threat intelligence | 40 | External confirmation from a real database |
| ML content model | 35 | Trained pattern recognition (F1=0.961 on held-out data) |
| Sender / domain analysis | 30 each | Strong deterministic spoofing/lookalike signals |
| URL analysis | 30 | Strong deterministic structural signals |
| Authentication (SPF/DKIM/DMARC) | 25 | Real but not conclusive alone (legitimate misconfig exists) |
| Content-analysis phrase matches | 20 | Weak alone — many legit emails use urgent language too |
| Received-chain / timestamp anomalies | 15 each | Heuristic, real clock skew happens |
| Message-ID mismatch | 10 | Common and often legitimate (mailing lists, forwarders) |
| IP geolocation | 10 | Informational — infrastructure location isn't guilt |

## Levels

- **0-24: LOW** — no action needed
- **25-49: MEDIUM** — a single strong signal, or several weak ones; worth a
  look
- **50-74: HIGH** — multiple corroborating sources agree
- **75-100: CRITICAL** — severe, corroborated across independent sources

A single `critical`-severity finding from one source alone only reaches 25
points (MEDIUM) — genuine CRITICAL requires corroboration across multiple
independent evidence categories, by design (see
`risk-engine/index.test.ts`).

## What this deliberately does NOT do

- It does not weight by "how many findings" in a source beyond the cap —
  ten low findings and four low findings from the same source score the
  same once the cap is hit, since more of the same weak signal isn't
  meaningfully stronger evidence.
- It never subtracts points for "positive" signals (e.g. SPF pass) — an
  absence of red flags is the natural LOW-score outcome, not a bonus.
