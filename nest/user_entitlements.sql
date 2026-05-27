create table if not exists user_entitlements (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  product text not null,
  granted_at timestamptz default now(),
  granted_by text default 'manual',
  active boolean default true
);

alter table user_entitlements enable row level security;

drop policy if exists "users read own entitlements" on user_entitlements;
create policy "users read own entitlements"
  on user_entitlements for select
  using (auth.uid() = user_id);

drop policy if exists "service role insert" on user_entitlements;
create policy "service role insert"
  on user_entitlements for insert
  with check (true);
