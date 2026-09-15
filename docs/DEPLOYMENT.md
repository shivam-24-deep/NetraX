# Deployment

## Local development (verified working — see docs/FINAL_STATUS.md §7)

Three processes: the Vite frontend, the Python ML inference API, and either
`server/local-api.ts` (Node, works today with no extra setup) or the real
Supabase Edge Functions (requires the steps below).

## Moving from `server/local-api.ts` to real Supabase Edge Functions

`server/local-api.ts` and `supabase/functions/*/index.ts` both call the
exact same underlying logic in `supabase/functions/_shared/` — nothing
about the business logic needs to change to switch. What's needed:

1. **Supabase CLI**: `npm install -g supabase` (or the platform installer),
   then `supabase login` and `supabase link --project-ref <your-project-ref>`.
2. **Apply the database schema**: `supabase db push` (applies
   `supabase/migrations/20260906120000_email_forensics_schema.sql`), or use
   the SQL editor in the Supabase dashboard.
3. **Deploy the functions**:
   `supabase functions deploy parse-email analyze-url check-threat-intel geolocate-ip investigate-email`
4. **Set secrets** the functions need: `supabase secrets set PHISHTANK_APP_KEY=... URLHAUS_AUTH_KEY=... MAXMIND_ACCOUNT_ID=... MAXMIND_LICENSE_KEY=... ML_API_URL=...`
5. **Point the frontend at the deployed functions**: update
   `VITE_LOCAL_API_URL` (or add a Supabase-functions-specific base URL) to
   `https://<project-ref>.supabase.co/functions/v1`.

None of this was performed in this session (see `docs/FINAL_STATUS.md` §5
for why: no Docker/Deno CLI locally, and the Supabase tool available here
is connected to a different project than the one in `frontend/.env`).

## ML inference API

`ml/api/server.py` (FastAPI) is a separate process from the Edge Functions/
local API server. In production, deploy it anywhere that runs Python
(a small VM, a container service) and point `ML_API_URL` at it. It's
optional by design — every caller degrades gracefully if it's unreachable.

## Environment variables

See `.env.example` — every variable documents what it's for and what
happens if it's absent.
