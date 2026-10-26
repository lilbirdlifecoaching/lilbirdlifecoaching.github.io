-- My Journey reflections. Proposed migration only.
-- Do not run this in production until it is explicitly approved.
-- The Nest worker must not write this table. Members insert and delete their own rows.

create table if not exists public.journey_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tool_id text not null,
  tool_version integer not null,
  answers jsonb not null,
  insight text,
  next_step text,
  created_at timestamptz not null default now(),
  constraint journey_reflections_tool_id_check check (tool_id ~ '^[a-z0-9-]{2,40}$'),
  constraint journey_reflections_version_check check (tool_version >= 1 and tool_version <= 99),
  constraint journey_reflections_answers_object check (jsonb_typeof(answers) = 'object'),
  constraint journey_reflections_answers_size check (octet_length(answers::text) <= 20000),
  constraint journey_reflections_insight_size check (insight is null or char_length(insight) <= 2000),
  constraint journey_reflections_next_step_size check (next_step is null or char_length(next_step) <= 500)
);

create index if not exists journey_reflections_user_created_idx
  on public.journey_reflections (user_id, created_at desc);

create index if not exists journey_reflections_user_tool_created_idx
  on public.journey_reflections (user_id, tool_id, created_at desc);

alter table public.journey_reflections enable row level security;

drop policy if exists "members read own reflections" on public.journey_reflections;
create policy "members read own reflections"
  on public.journey_reflections
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members insert own reflections" on public.journey_reflections;
create policy "members insert own reflections"
  on public.journey_reflections
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "members delete own reflections" on public.journey_reflections;
create policy "members delete own reflections"
  on public.journey_reflections
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.journey_reflections from anon;
revoke all on public.journey_reflections from authenticated;
grant select, insert, delete on public.journey_reflections to authenticated;
