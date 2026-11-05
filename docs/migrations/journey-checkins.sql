-- Lil' Bird Nest Phase 2b — journey_checkins
-- Apply manually in Supabase after product approval. Do NOT run from Nest worker.
-- Does not alter journey_reflections columns or member grants (still select/insert/delete).
-- Rollback at bottom. Reflections are preserved on rollback.

-- ---------------------------------------------------------------------------
-- 1. Append-only check-in / focus events (single source of truth for focus)
-- ---------------------------------------------------------------------------

create table if not exists public.journey_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- SET NULL on reflection delete: newest orphaned event ⇒ resting (no resurrect).
  reflection_id uuid references public.journey_reflections (id) on delete set null,
  response text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint journey_checkins_response_check check (
    response in (
      'took_step',
      'still_working',
      'changed',
      'done_for_now',
      'choose_again',
      'activated'
    )
  ),
  constraint journey_checkins_note_size check (note is null or char_length(note) <= 1000)
);

create index if not exists journey_checkins_user_created_id_idx
  on public.journey_checkins (user_id, created_at desc, id desc);

create index if not exists journey_checkins_user_reflection_created_idx
  on public.journey_checkins (user_id, reflection_id, created_at desc);

alter table public.journey_checkins enable row level security;

drop policy if exists "members read own checkins" on public.journey_checkins;
create policy "members read own checkins"
  on public.journey_checkins
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "members insert own checkins" on public.journey_checkins;
create policy "members insert own checkins"
  on public.journey_checkins
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and reflection_id is not null
    and exists (
      select 1
      from public.journey_reflections r
      where r.id = reflection_id
        and r.user_id = auth.uid()
    )
  );

drop policy if exists "members delete own checkins" on public.journey_checkins;
create policy "members delete own checkins"
  on public.journey_checkins
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on public.journey_checkins from anon;
revoke all on public.journey_checkins from authenticated;
grant select, insert, delete on public.journey_checkins to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Activate on new next-step reflection (same transaction as the insert)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER + fixed search_path. EXECUTE revoked from clients; only the
-- trigger on journey_reflections may fire this.

create or replace function public.journey_activate_on_next_step()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;
  if new.next_step is null or btrim(new.next_step) = '' then
    return new;
  end if;
  insert into public.journey_checkins (user_id, reflection_id, response, note)
  values (new.user_id, new.id, 'activated', null);
  return new;
end;
$$;

drop trigger if exists journey_reflections_activate_focus on public.journey_reflections;
create trigger journey_reflections_activate_focus
  after insert on public.journey_reflections
  for each row
  execute function public.journey_activate_on_next_step();

revoke all on function public.journey_activate_on_next_step() from public;
revoke all on function public.journey_activate_on_next_step() from anon;
revoke all on function public.journey_activate_on_next_step() from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Privacy on reflection delete
--    a) Clear personal notes before FK nulls reflection_id
--    b) If the member has no reflections left, delete all their check-ins
--       (including orphans) so "clear my Journey" leaves no check-in residue
-- ---------------------------------------------------------------------------

create or replace function public.journey_clear_checkin_notes_on_reflection_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.journey_checkins
  set note = null
  where reflection_id = old.id
    and user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists journey_reflections_clear_checkin_notes on public.journey_reflections;
create trigger journey_reflections_clear_checkin_notes
  before delete on public.journey_reflections
  for each row
  execute function public.journey_clear_checkin_notes_on_reflection_delete();

revoke all on function public.journey_clear_checkin_notes_on_reflection_delete() from public;
revoke all on function public.journey_clear_checkin_notes_on_reflection_delete() from anon;
revoke all on function public.journey_clear_checkin_notes_on_reflection_delete() from authenticated;

create or replace function public.journey_purge_checkins_when_no_reflections()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.journey_reflections r
    where r.user_id = old.user_id
  ) then
    delete from public.journey_checkins
    where user_id = old.user_id;
  end if;
  return old;
end;
$$;

drop trigger if exists journey_reflections_purge_checkins on public.journey_reflections;
create trigger journey_reflections_purge_checkins
  after delete on public.journey_reflections
  for each row
  execute function public.journey_purge_checkins_when_no_reflections();

revoke all on function public.journey_purge_checkins_when_no_reflections() from public;
revoke all on function public.journey_purge_checkins_when_no_reflections() from anon;
revoke all on function public.journey_purge_checkins_when_no_reflections() from authenticated;

-- ---------------------------------------------------------------------------
-- 4. Optional read model (not a write target; legacy zero-event members absent)
-- ---------------------------------------------------------------------------

create or replace view public.journey_active_focus
with (security_invoker = true)
as
select distinct on (c.user_id)
  c.user_id,
  case
    when c.response in ('changed', 'done_for_now') then null
    when c.reflection_id is null then null
    when r.id is null then null
    when r.next_step is null or btrim(r.next_step) = '' then null
    else c.reflection_id
  end as reflection_id,
  c.id as source_checkin_id,
  c.response as source_response,
  c.created_at as decided_at
from public.journey_checkins c
left join public.journey_reflections r on r.id = c.reflection_id
order by c.user_id, c.created_at desc, c.id desc;

revoke all on public.journey_active_focus from anon;
grant select on public.journey_active_focus to authenticated;

-- ---------------------------------------------------------------------------
-- Rollback (reflections preserved)
-- ---------------------------------------------------------------------------
-- drop trigger if exists journey_reflections_activate_focus on public.journey_reflections;
-- drop trigger if exists journey_reflections_clear_checkin_notes on public.journey_reflections;
-- drop trigger if exists journey_reflections_purge_checkins on public.journey_reflections;
-- drop function if exists public.journey_activate_on_next_step();
-- drop function if exists public.journey_clear_checkin_notes_on_reflection_delete();
-- drop function if exists public.journey_purge_checkins_when_no_reflections();
-- drop view if exists public.journey_active_focus;
-- drop table if exists public.journey_checkins;
