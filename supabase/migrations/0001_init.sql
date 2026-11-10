-- Let Me Finish: schema with row-level security (blueprint §08). Apply with `supabase db push`.
-- Every table is owned by one user; users can only ever see and change their own rows.
create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  locale text,
  age_confirmed boolean not null default false
);
create table public.profiles (
  user_id uuid primary key references public.users (id) on delete cascade,
  goals_json jsonb not null default '{}', preferences_json jsonb not null default '{}', updated_at timestamptz not null default now()
);
create table public.consents (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users (id) on delete cascade,
  purpose text not null check (purpose in ('core','voice','ai','transcripts','research','training')),
  version text not null, granted_at timestamptz not null default now(), revoked_at timestamptz
);
create table public.exercise_modules (
  id text primary key, title text not null, version text not null, reviewer_id uuid, reviewed_on date, evidence text,
  contraindications text, published_at timestamptz   -- published only after clinician review
);
create table public.practice_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users (id) on delete cascade,
  module_id text references public.exercise_modules (id), duration int, completed_at timestamptz not null default now()
);
create table public.roleplay_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users (id) on delete cascade,
  scenario_id text not null, consent_snapshot_id uuid references public.consents (id), metadata jsonb not null default '{}'
);
create table public.journeys (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users (id) on delete cascade,
  scenario jsonb not null default '{}', status text not null default 'prepare', target_date date
);
create table public.reflections (
  id uuid primary key default gen_random_uuid(), journey_id uuid not null references public.journeys (id) on delete cascade,
  confidence smallint check (confidence between 1 and 5), effort smallint check (effort between 1 and 5),
  participation smallint check (participation between 1 and 5), notes text
);
create table public.audio_assets (   -- optional uploads only; expire automatically
  id uuid primary key default gen_random_uuid(), user_id uuid not null references public.users (id) on delete cascade,
  storage_key text not null, expires_at timestamptz not null, explicit_opt_in boolean not null check (explicit_opt_in)
);
create table public.audit_events (
  id uuid primary key default gen_random_uuid(), actor_id uuid, action text not null, resource text, "timestamp" timestamptz not null default now()
);

create or replace function public.current_user_id() returns uuid language sql stable security definer set search_path = public as
$$ select id from public.users where auth_id = auth.uid() $$;

alter table public.users enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.exercise_modules enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.roleplay_sessions enable row level security;
alter table public.journeys enable row level security;
alter table public.reflections enable row level security;
alter table public.audio_assets enable row level security;
alter table public.audit_events enable row level security;

create policy users_own on public.users for all to authenticated using (auth_id = auth.uid()) with check (auth_id = auth.uid());
create policy profiles_own on public.profiles for all to authenticated using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy consents_own on public.consents for all to authenticated using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy practice_own on public.practice_sessions for all to authenticated using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy roleplay_own on public.roleplay_sessions for all to authenticated using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy journeys_own on public.journeys for all to authenticated using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
create policy reflections_own on public.reflections for all to authenticated
  using (exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = public.current_user_id()))
  with check (exists (select 1 from public.journeys j where j.id = journey_id and j.user_id = public.current_user_id()));
create policy audio_own on public.audio_assets for all to authenticated using (user_id = public.current_user_id()) with check (user_id = public.current_user_id());
-- Published, reviewed modules are readable by everyone signed in; nobody can write them from the client.
create policy modules_read on public.exercise_modules for select to authenticated using (published_at is not null);
-- Audit events: a person may read their own; writes come from the server (service role) only.
create policy audit_read_own on public.audit_events for select to authenticated using (actor_id = public.current_user_id());
