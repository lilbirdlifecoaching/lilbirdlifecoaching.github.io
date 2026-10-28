-- Release A claim guard. Do not run this until the reviewed worker is deployed
-- in the same change. It does not update, delete, or deactivate existing
-- user_entitlements rows. A claim that fails the email check raises an
-- exception and writes nothing.

create table if not exists public.nest_owner_emails (
  nest_id text primary key,
  email text not null,
  bound_at timestamptz not null default now()
);

alter table public.nest_owner_emails enable row level security;
revoke all on public.nest_owner_emails from anon, authenticated;
grant all on public.nest_owner_emails to service_role;

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
  v_bound text;
  v_caller text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if v_nest is null then
    raise exception 'missing nest id';
  end if;

  select lower(email) into v_bound
  from public.nest_owner_emails
  where nest_id = v_nest;

  if v_bound is null or v_caller = '' or v_bound <> v_caller then
    raise exception 'not allowed';
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
