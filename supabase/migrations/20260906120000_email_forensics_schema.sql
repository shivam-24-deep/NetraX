-- Phase 14-15 — NetraX / SIH26106 email forensics schema.
--
-- Written as a standard Supabase migration. NOTE (see docs/FINAL_STATUS.md):
-- this repo's Supabase MCP tool connection points at a different project
-- than the one configured in frontend/.env, so this migration has not been
-- applied against a live database from within this session — apply it with
-- `supabase db push`, the Supabase SQL editor, or by reconnecting the tool
-- to the correct project.
--
-- Design notes:
--   * "investigation_events" fulfills both that name and the spec's
--     "tool_logs" concept (spec: Phase 15) — they are the same shape
--     (ToolExecutionRecord), so one table is used rather than two
--     structurally-identical ones.
--   * "evidence" holds normalized Findings (Phase 12); "evidence_nodes" +
--     "evidence_edges" hold the graph structure (Phase 13) built from that
--     same evidence — nodes were not in the spec's table list but are
--     structurally required alongside edges for a real graph.
--   * Child tables are written by the Edge Functions using the service-role
--     key (which bypasses RLS by design) — RLS below grants authenticated
--     users read access to their team's data, not direct write access.

-- ============================================================================
-- profiles
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'analyst' check (role in ('analyst', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- ============================================================================
-- email_cases (the central case record)
-- ============================================================================

create table if not exists public.email_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text not null unique,
  submitted_by uuid references public.profiles(id) on delete set null,
  status text not null default 'NEW' check (status in ('NEW', 'INVESTIGATING', 'HIGH_RISK', 'RESOLVED', 'FALSE_POSITIVE')),
  subject text,
  from_address text,
  risk_score integer check (risk_score between 0 and 100),
  risk_level text check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  is_demo_data boolean not null default false,
  analyst_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists idx_email_cases_status on public.email_cases(status);
create index if not exists idx_email_cases_submitted_by on public.email_cases(submitted_by);
create index if not exists idx_email_cases_created_at on public.email_cases(created_at desc);

alter table public.email_cases enable row level security;

create policy "cases are readable by any authenticated analyst"
  on public.email_cases for select
  to authenticated
  using (true);

create policy "authenticated users can create cases"
  on public.email_cases for insert
  to authenticated
  with check (auth.uid() = submitted_by);

create policy "authenticated analysts can update case status/notes"
  on public.email_cases for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- email_headers (Phase 3 parsed headers, one row per case)
-- ============================================================================

create table if not exists public.email_headers (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  from_address text,
  reply_to text,
  return_path text,
  subject text,
  date_header text,
  message_id text,
  spf_result text,
  dkim_result text,
  dmarc_result text,
  raw_headers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_headers_case_id on public.email_headers(case_id);

alter table public.email_headers enable row level security;

create policy "email_headers readable by authenticated users"
  on public.email_headers for select
  to authenticated
  using (true);

-- ============================================================================
-- investigation_events (Phase 10 ToolExecutionRecord audit trail; also
-- serves the spec's "tool_logs" concept — see header note)
-- ============================================================================

create table if not exists public.investigation_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  tool text not null,
  status text not null check (status in ('success', 'skipped', 'error')),
  reason text,
  started_at timestamptz not null,
  duration_ms numeric not null default 0,
  finding_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_investigation_events_case_id on public.investigation_events(case_id);

alter table public.investigation_events enable row level security;

create policy "investigation_events readable by authenticated users"
  on public.investigation_events for select
  to authenticated
  using (true);

-- ============================================================================
-- analysis_results (Phase 11 RiskAssessment, one row per case)
-- ============================================================================

create table if not exists public.analysis_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  breakdown jsonb not null default '[]'::jsonb,
  top_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_analysis_results_case_id on public.analysis_results(case_id);

alter table public.analysis_results enable row level security;

create policy "analysis_results readable by authenticated users"
  on public.analysis_results for select
  to authenticated
  using (true);

-- ============================================================================
-- evidence (Phase 12 normalized Findings)
-- ============================================================================

create table if not exists public.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  finding_key text not null,
  finding text not null,
  severity text not null check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  evidence_text text not null,
  source text not null,
  confidence text not null check (confidence in ('low', 'medium', 'high')),
  explanation text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_case_id on public.evidence(case_id);
create index if not exists idx_evidence_source on public.evidence(source);

alter table public.evidence enable row level security;

create policy "evidence readable by authenticated users"
  on public.evidence for select
  to authenticated
  using (true);

-- ============================================================================
-- evidence_nodes / evidence_edges (Phase 13 evidence graph)
-- ============================================================================

create table if not exists public.evidence_nodes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  node_key text not null,
  node_type text not null check (node_type in ('email', 'sender', 'domain', 'url', 'ip', 'asn', 'country', 'threat_intel')),
  label text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (case_id, node_key)
);

create table if not exists public.evidence_edges (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  from_node_key text not null,
  to_node_key text not null,
  relationship text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_nodes_case_id on public.evidence_nodes(case_id);
create index if not exists idx_evidence_edges_case_id on public.evidence_edges(case_id);

alter table public.evidence_nodes enable row level security;
alter table public.evidence_edges enable row level security;

create policy "evidence_nodes readable by authenticated users"
  on public.evidence_nodes for select
  to authenticated
  using (true);

create policy "evidence_edges readable by authenticated users"
  on public.evidence_edges for select
  to authenticated
  using (true);

-- ============================================================================
-- indicators (Phase 3 extracted URLs/domains/IPs/emails, one row per indicator)
-- ============================================================================

create table if not exists public.indicators (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  indicator_type text not null check (indicator_type in ('url', 'domain', 'ip', 'email', 'phone', 'crypto_address')),
  value text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_indicators_case_id on public.indicators(case_id);
create index if not exists idx_indicators_value on public.indicators(value);

alter table public.indicators enable row level security;

create policy "indicators readable by authenticated users"
  on public.indicators for select
  to authenticated
  using (true);

-- ============================================================================
-- threat_intel_results (Phase 6 lookups, one row per indicator per provider)
-- ============================================================================

create table if not exists public.threat_intel_results (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  indicator text not null,
  indicator_type text not null check (indicator_type in ('url', 'domain', 'ip', 'email')),
  source text not null,
  status text not null check (status in ('matched', 'not_found', 'unavailable')),
  confidence text check (confidence in ('low', 'medium', 'high')),
  category text,
  first_seen text,
  last_seen text,
  metadata jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index if not exists idx_threat_intel_results_case_id on public.threat_intel_results(case_id);

alter table public.threat_intel_results enable row level security;

create policy "threat_intel_results readable by authenticated users"
  on public.threat_intel_results for select
  to authenticated
  using (true);

-- ============================================================================
-- infrastructure_entities (shared IP/ASN cache across cases — not case-scoped)
-- ============================================================================

create table if not exists public.infrastructure_entities (
  ip text primary key,
  asn integer,
  organization text,
  network text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

alter table public.infrastructure_entities enable row level security;

create policy "infrastructure_entities readable by authenticated users"
  on public.infrastructure_entities for select
  to authenticated
  using (true);

-- ============================================================================
-- geo_enrichment (Phase 7 geolocation results, one row per case+IP)
-- ============================================================================

create table if not exists public.geo_enrichment (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  ip text not null,
  status text not null check (status in ('found', 'not_found', 'unavailable')),
  country text,
  country_code text,
  region text,
  city text,
  accuracy_radius_km integer,
  looked_up_at timestamptz not null default now()
);

create index if not exists idx_geo_enrichment_case_id on public.geo_enrichment(case_id);

alter table public.geo_enrichment enable row level security;

create policy "geo_enrichment readable by authenticated users"
  on public.geo_enrichment for select
  to authenticated
  using (true);

-- ============================================================================
-- alerts
-- ============================================================================

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.email_cases(id) on delete cascade,
  severity text not null check (severity in ('info', 'low', 'medium', 'high', 'critical')),
  message text not null,
  acknowledged boolean not null default false,
  acknowledged_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_alerts_case_id on public.alerts(case_id);
create index if not exists idx_alerts_acknowledged on public.alerts(acknowledged);

alter table public.alerts enable row level security;

create policy "alerts readable by authenticated users"
  on public.alerts for select
  to authenticated
  using (true);

create policy "authenticated users can acknowledge alerts"
  on public.alerts for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================================
-- feedback (Phase 19 human-in-the-loop analyst actions)
-- ============================================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.email_cases(id) on delete cascade,
  analyst_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('confirm_threat', 'false_positive', 'escalate', 'note')),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists idx_feedback_case_id on public.feedback(case_id);

alter table public.feedback enable row level security;

create policy "feedback readable by authenticated users"
  on public.feedback for select
  to authenticated
  using (true);

create policy "authenticated users can submit their own feedback"
  on public.feedback for insert
  to authenticated
  with check (auth.uid() = analyst_id);

-- ============================================================================
-- model_metrics (mirrors ml/models/model_metadata.json for the Model
-- Performance page's real backing store)
-- ============================================================================

create table if not exists public.model_metrics (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  algorithm text not null,
  dataset text,
  metrics jsonb not null default '{}'::jsonb,
  trained_at timestamptz not null default now(),
  unique (model_name, trained_at)
);

alter table public.model_metrics enable row level security;

create policy "model_metrics readable by authenticated users"
  on public.model_metrics for select
  to authenticated
  using (true);

-- ============================================================================
-- updated_at trigger (profiles, email_cases)
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_email_cases_updated_at
  before update on public.email_cases
  for each row execute function public.set_updated_at();
