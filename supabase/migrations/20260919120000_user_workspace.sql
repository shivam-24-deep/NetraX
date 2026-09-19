-- NetraX per-user workspace schema.
--
-- Every user's investigations and alerts are private to that user (Row Level
-- Security on auth.uid()). A brand-new signup starts completely empty — there
-- is no seed or demo data anywhere in this schema.
--
-- How to apply: Supabase dashboard -> SQL Editor -> New query -> paste this
-- whole file -> Run. It is safe to run more than once.

-- ============================================================================
-- updated_at helper
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================================
-- profiles — one row per user, created automatically on signup
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Profiles for accounts that already existed before this migration.
insert into public.profiles (id, email, display_name)
select
  u.id,
  u.email,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    split_part(u.email, '@', 1)
  )
from auth.users u
on conflict (id) do nothing;

-- ============================================================================
-- cases — one row per investigation. Frequently-filtered fields are real
-- columns; the complete case (evidence, graph, timeline, raw email, ...) is
-- kept in `data` so nothing the app shows is ever lost or re-derived.
-- ============================================================================

create table if not exists public.cases (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  input_type text not null,
  category text not null,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null,
  source text,
  email_hash text,
  saved boolean not null default false,
  watchlisted boolean not null default false,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists cases_user_created_idx on public.cases (user_id, created_at desc);
create index if not exists cases_user_email_hash_idx on public.cases (user_id, email_hash) where email_hash is not null;

alter table public.cases enable row level security;

drop policy if exists "cases: read own" on public.cases;
create policy "cases: read own"
  on public.cases for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "cases: insert own" on public.cases;
create policy "cases: insert own"
  on public.cases for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "cases: update own" on public.cases;
create policy "cases: update own"
  on public.cases for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "cases: delete own" on public.cases;
create policy "cases: delete own"
  on public.cases for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists set_cases_updated_at on public.cases;
create trigger set_cases_updated_at
  before update on public.cases
  for each row execute function public.set_updated_at();

-- ============================================================================
-- alerts — created automatically when a case scores HIGH or CRITICAL
-- ============================================================================

create table if not exists public.alerts (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id text not null,
  case_id text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  threat_type text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists alerts_user_created_idx on public.alerts (user_id, created_at desc);

alter table public.alerts enable row level security;

drop policy if exists "alerts: read own" on public.alerts;
create policy "alerts: read own"
  on public.alerts for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "alerts: insert own" on public.alerts;
create policy "alerts: insert own"
  on public.alerts for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "alerts: delete own" on public.alerts;
create policy "alerts: delete own"
  on public.alerts for delete to authenticated
  using ((select auth.uid()) = user_id);
