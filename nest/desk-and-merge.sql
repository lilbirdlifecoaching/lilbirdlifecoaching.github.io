-- Nest account merge, live door, waitlist, and staff desk.
-- Run once in Supabase SQL Editor (project mebqqzbuwkogdxvnihrq).
-- Service role (the Solo worker) writes these tables. Members do not.

create table if not exists public.nest_reads (
  user_id uuid not null references auth.users (id) on delete cascade,
  nest_id text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, nest_id)
);

alter table public.nest_reads enable row level security;
drop policy if exists "users read own nest reads" on public.nest_reads;
create policy "users read own nest reads"
  on public.nest_reads for select to authenticated
  using (auth.uid() = user_id);
grant select on public.nest_reads to authenticated;

create table if not exists public.account_merge_tokens (
  id uuid primary key default gen_random_uuid(),
  keeper_user_id uuid not null references auth.users (id) on delete cascade,
  other_email text not null,
  other_user_id uuid,
  token_hash text not null unique,
  inbox_verified_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.account_merge_tokens enable row level security;
grant all on public.account_merge_tokens to service_role;

create table if not exists public.account_merges (
  id uuid primary key default gen_random_uuid(),
  keeper_user_id uuid not null,
  other_user_id uuid,
  other_email text not null,
  actor_email text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  undone_at timestamptz
);

alter table public.account_merges enable row level security;
grant all on public.account_merges to service_role;

create table if not exists public.premium_waitlist (
  email text primary key,
  user_id uuid,
  created_at timestamptz not null default now()
);

alter table public.premium_waitlist enable row level security;
grant all on public.premium_waitlist to service_role;

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  zoom_url text,
  capacity int not null default 15,
  status text not null default 'scheduled',
  created_at timestamptz not null default now(),
  constraint live_sessions_status_check check (status in ('scheduled', 'live', 'ended'))
);

alter table public.live_sessions enable row level security;
grant all on public.live_sessions to service_role;

create table if not exists public.live_roster (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  status text not null default 'in',
  note text,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id),
  constraint live_roster_status_check check (status in ('in', 'removed'))
);

alter table public.live_roster enable row level security;
grant all on public.live_roster to service_role;

create table if not exists public.desk_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  email text,
  user_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

alter table public.desk_alerts enable row level security;
grant all on public.desk_alerts to service_role;

create table if not exists public.staff_members (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.staff_members enable row level security;
grant all on public.staff_members to service_role;

create table if not exists public.account_closes (
  user_id uuid primary key,
  email text,
  closed_at timestamptz not null default now()
);

alter table public.account_closes enable row level security;
grant all on public.account_closes to service_role;

-- A second Compass stays beside the first. Linking no longer replaces the read already on the account.
create or replace function public.link_deep_profile_to_user(p_nest_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_nest text := nullif(trim(p_nest_id), '');
  v_current text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_nest is null then
    raise exception 'missing nest id';
  end if;

  select nest_id into v_current from public.deep_profile_links where user_id = v_uid;

  if v_current is null then
    insert into public.deep_profile_links (user_id, nest_id, completed_at, last_seen_at)
    values (v_uid, v_nest, now(), now());
    insert into public.nest_reads (user_id, nest_id, is_primary)
    values (v_uid, v_nest, true)
    on conflict (user_id, nest_id) do update set is_primary = true;
  elsif v_current = v_nest then
    update public.deep_profile_links set last_seen_at = now() where user_id = v_uid;
  else
    insert into public.nest_reads (user_id, nest_id, is_primary)
    values (v_uid, v_nest, false)
    on conflict (user_id, nest_id) do nothing;
  end if;

  insert into public.user_entitlements (user_id, product, granted_by, active)
  values (v_uid, 'inner_compass', 'profile_link', true)
  on conflict (user_id, product) do update
    set active = true, granted_at = now();

  return jsonb_build_object('nest_id', coalesce(v_current, v_nest), 'added', v_nest);
end;
$$;

notify pgrst, 'reload schema';
