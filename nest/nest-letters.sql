-- Nest coaching letters.
-- Applied in production on 26 Oct 2026. Do not run this file again.
-- Cloudflare KV cannot lock two cron runs safely. This table is the delivery record.
-- Service role only. Members change preferences through the assessment worker.

create table if not exists public.nest_letter_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  nest_coaching boolean not null default false,
  product_coaching boolean not null default true,
  status text not null,
  phase text not null,
  step integer not null default 0,
  checkin_cycle integer not null default 0,
  next_at timestamptz,
  letter_start_at timestamptz,
  welcome_sent boolean not null default false,
  attempt integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.nest_letter_deliveries (
  delivery_id text primary key,
  user_id uuid not null,
  letter_key text not null,
  status text not null,
  claimed_at timestamptz not null default now(),
  first_claimed_at timestamptz not null default now(),
  sent_at timestamptz,
  uncertain_at timestamptz,
  unique (user_id, letter_key)
);

create table if not exists public.nest_letter_lock (
  id integer primary key check (id = 1),
  holder text,
  expires_at timestamptz
);

alter table public.nest_letter_state enable row level security;
alter table public.nest_letter_deliveries enable row level security;
alter table public.nest_letter_lock enable row level security;

revoke all on public.nest_letter_state from anon, authenticated;
revoke all on public.nest_letter_deliveries from anon, authenticated;
revoke all on public.nest_letter_lock from anon, authenticated;

create or replace function public.nest_letter_try_lock(p_holder text, p_ttl_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  got boolean;
begin
  insert into public.nest_letter_lock (id, holder, expires_at)
  values (1, p_holder, now() + make_interval(secs => p_ttl_seconds))
  on conflict (id) do update
    set holder = excluded.holder,
        expires_at = excluded.expires_at
    where public.nest_letter_lock.expires_at < now()
       or public.nest_letter_lock.holder = excluded.holder
  returning true into got;
  return coalesce(got, false);
end;
$$;

revoke all on function public.nest_letter_try_lock(text, integer) from public, anon, authenticated;
grant execute on function public.nest_letter_try_lock(text, integer) to service_role;
