-- Release A link proof. Run this in the same script as nest/release-a-claim.sql,
-- immediately after it. Do not wait for the Worker. See nest/release-a-hotfix.sql.
--
-- Existing deep_profile_links rows are left untouched. A null ownership_proof
-- is a legacy link and is not proof of assessment ownership.
-- This file does not delete links and does not change user_entitlements.
--
-- A member who can show the email already stored in nest_owner_emails may
-- confirm that one link. That confirmation is a new check, not a backfill.

alter table public.deep_profile_links
  add column if not exists ownership_proof text;

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
    insert into public.deep_profile_links (user_id, nest_id, completed_at, last_seen_at, ownership_proof)
    values (v_uid, v_nest, now(), now(), 'owner_email');
    insert into public.nest_reads (user_id, nest_id, is_primary)
    values (v_uid, v_nest, true)
    on conflict (user_id, nest_id) do update set is_primary = true;
  elsif v_current = v_nest then
    update public.deep_profile_links
      set last_seen_at = now(),
          ownership_proof = coalesce(ownership_proof, 'owner_email')
      where user_id = v_uid;
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

revoke insert, update, delete on public.deep_profile_links from anon, authenticated;
revoke insert, update, delete on public.nest_reads from anon, authenticated;
grant select on public.deep_profile_links to authenticated;
grant select on public.nest_reads to authenticated;
grant all on public.deep_profile_links to service_role;
grant all on public.nest_reads to service_role;
grant all on public.nest_owner_emails to service_role;
revoke execute on function public.link_deep_profile_to_user(text) from public, anon;
grant execute on function public.link_deep_profile_to_user(text) to authenticated;

notify pgrst, 'reload schema';
