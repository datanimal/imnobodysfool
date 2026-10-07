-- I'm Nobody's Fool: accounts upgrade. Run this once, AFTER supabase-setup.sql.
-- It lets people sign in with an emailed code and see their own results. Nobody can see anyone else's.

-- Results and inbox sign-ups remember who was signed in (empty for anonymous players).
alter table results       add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete set null;
alter table inbox_signups add column if not exists user_id uuid default auth.uid() references auth.users(id) on delete set null;

-- One row per signed-in person: their level and the questions they have seen.
create table if not exists profiles (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  skill numeric not null default 1,
  seen jsonb not null default '[]',
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- Anonymous players may only add rows that belong to nobody.
drop policy if exists "website can add" on results;
create policy "website can add" on results for insert to anon with check (user_id is null);

-- Signed-in people: add their own rows, read their own rows.
grant insert, select on results to authenticated;
grant insert on inbox_signups, sender_signups, inbox_clicks to authenticated;
grant select, insert, update on profiles to authenticated;

create policy "member can add own"  on results for insert to authenticated with check (user_id = auth.uid());
create policy "member can read own" on results for select to authenticated using (user_id = auth.uid());
create policy "member can add" on inbox_signups  for insert to authenticated with check (user_id = auth.uid());
create policy "member can add" on sender_signups for insert to authenticated with check (true);
create policy "member can add" on inbox_clicks   for insert to authenticated with check (true);
create policy "member reads own profile"   on profiles for select to authenticated using (user_id = auth.uid());
create policy "member creates own profile" on profiles for insert to authenticated with check (user_id = auth.uid());
create policy "member updates own profile" on profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
