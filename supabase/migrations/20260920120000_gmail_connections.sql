-- Per-user Gmail auto-detect connection.
--
-- One row per user. The Google OAuth tokens are stored ENCRYPTED (AES-256-GCM)
-- in `secret` with a key that only the API server holds (GMAIL_TOKEN_KEY), so
-- reading this table — even as the owning user — yields only ciphertext.
-- Row-level security scopes every operation to the signed-in user's own row.
--
-- How to apply: Supabase dashboard -> SQL Editor -> New query -> paste this
-- whole file -> Run. Safe to run more than once. (Requires the earlier
-- 20260919120000_user_workspace.sql, which defines public.set_updated_at().)

create table if not exists public.gmail_connections (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  google_email text,
  secret text not null,
  seen_ids jsonb not null default '[]'::jsonb,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.gmail_connections enable row level security;

drop policy if exists "gmail_connections: read own" on public.gmail_connections;
create policy "gmail_connections: read own"
  on public.gmail_connections for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "gmail_connections: insert own" on public.gmail_connections;
create policy "gmail_connections: insert own"
  on public.gmail_connections for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "gmail_connections: update own" on public.gmail_connections;
create policy "gmail_connections: update own"
  on public.gmail_connections for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "gmail_connections: delete own" on public.gmail_connections;
create policy "gmail_connections: delete own"
  on public.gmail_connections for delete to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists set_gmail_connections_updated_at on public.gmail_connections;
create trigger set_gmail_connections_updated_at
  before update on public.gmail_connections
  for each row execute function public.set_updated_at();
