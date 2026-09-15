# Security

## Input handling

- **No arbitrary URL fetching.** Nothing in this codebase follows a link
  found in a submitted email. `url-analysis/` extracts structural features
  from the URL *string* only (length, hostname, path, encoding, etc.) —
  it never issues an HTTP request to the URL itself. This eliminates the
  most obvious SSRF vector (an attacker-controlled email causing the
  backend to make an outbound request to an attacker-chosen internal
  address) by construction, not by a filter that could have a gap.
- **No attachment execution.** `email/parser.ts` extracts attachment
  *metadata* only (filename, content-type, approximate size derived from
  base64 length) — attachment content is never decoded to text, executed,
  or persisted beyond that metadata.
- **Outbound calls are all to fixed, known hosts** the code itself chose
  (the ML API, PhishTank, URLhaus, MaxMind) — never to a host or path
  derived from user input. The one exception, geolocation, only ever
  queries the IP addresses this app itself extracted from headers, filtered
  to public-only via real CIDR classification (`geolocation/ip-classification.ts`,
  11 tests including boundary cases) before any lookup — private/reserved/
  loopback addresses are never sent anywhere.
- **Request size limits**: every Edge Function / local API route caps
  request body size (10MB for email content, 8KB for a single URL, 50 IPs
  per geolocation batch) to bound resource use from a single request.
- **Timeouts on every external call**: ML API (2.5s), threat intel (5s),
  MaxMind (5s) — a slow/hung external dependency degrades gracefully
  (`status: "unavailable"`) rather than hanging the investigation.

## Secrets

- No API key is ever hard-coded. `.env.example` documents every variable;
  real values live only in `frontend/.env` (gitignored) or the deployment
  environment.
- `GEMINI_API_KEY` is explicitly documented as server-side only — never
  prefixed `VITE_`, never bundled into client code, never called directly
  from the browser (see `.env.example`).
- The Supabase anon key is the one credential intentionally exposed to the
  browser bundle — by Supabase's own design, it's meant to be public and is
  useless without Row Level Security, which every table in
  `supabase/migrations/20260906120000_email_forensics_schema.sql` has
  enabled.

## Database (Row Level Security)

Every table has RLS enabled. The general pattern: authenticated users can
**read** case/evidence/forensics data (shared analyst team visibility —
this is a SOC-style collaborative tool, not per-user-siloed data), but only
the service-role key (used by backend Edge Functions, which bypasses RLS by
Supabase design) can **write** derived data like forensics findings, evidence
graph nodes, or threat-intel results — a client cannot forge evidence rows
directly. Users can only create cases attributed to themselves
(`submitted_by = auth.uid()`) and only submit feedback attributed to
themselves (`analyst_id = auth.uid()`).

## Known gap

This migration has been written and reviewed but not applied to a live
database in this session (see `docs/FINAL_STATUS.md` §5) — RLS policies
have not been tested against a real Postgres instance, only reviewed for
correctness against standard Supabase RLS patterns.

## What this build does NOT claim

- No rate limiting is implemented on the Edge Functions / local API beyond
  request-size caps — a production deployment behind Supabase would need
  Supabase's own rate limiting or an API gateway in front.
- No authentication is required to call the local dev API
  (`server/local-api.ts`) — it's a local development convenience, not
  intended to be exposed publicly. The Edge Function equivalents would sit
  behind Supabase's auth/JWT verification in a real deployment.
