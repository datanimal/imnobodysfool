-- I'm Nobody's Fool: database setup.
-- Paste this whole file into the Supabase SQL Editor and click Run. It is safe to run once on a new project.
-- The website can only ADD rows. It cannot read, change or delete anything. Only you can, when signed in to Supabase.

create table results (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  anon_id uuid,                 -- random id for one browser; not a name or email
  test text,                    -- 'emergency-call' or 'practice'
  correct int, total int, pct int,
  level_start numeric, level_end numeric,
  answers jsonb                 -- [{ "id": "bank-4", "ok": true, "d": 4 }, ...]
);

create table inbox_signups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 5 and 254),
  anon_id uuid,                 -- links this person to their anonymous results
  pct int, test text,
  code text not null default substr(md5(random()::text), 1, 8),  -- goes in their test links
  confirmed boolean not null default false,   -- set to true after they reply yes to your confirmation email
  stopped boolean not null default false      -- set to true if they ask to stop
);

create table sender_signups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 5 and 254)
);

create table inbox_clicks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  template text,                -- which test email was clicked
  code text                     -- matches inbox_signups.code
);

alter table results        enable row level security;
alter table inbox_signups  enable row level security;
alter table sender_signups enable row level security;
alter table inbox_clicks   enable row level security;

create policy "website can add" on results        for insert to anon with check (true);
create policy "website can add" on inbox_signups  for insert to anon with check (true);
create policy "website can add" on sender_signups for insert to anon with check (true);
create policy "website can add" on inbox_clicks   for insert to anon with check (true);

-- Newer Supabase projects do not let the website add rows unless this is granted explicitly.
grant usage on schema public to anon;
grant insert on results, inbox_signups, sender_signups, inbox_clicks to anon;

-- Reports for you. Open them under Table Editor, or run: select * from question_stats;
create view question_stats with (security_invoker = true) as
  select a->>'id' as question, (a->>'d')::int as difficulty, count(*) as times_answered,
         round(100.0 * avg(((a->>'ok')::boolean)::int)) as pct_correct
  from results, jsonb_array_elements(answers) a
  group by 1, 2 order by pct_correct;

create view test_summary with (security_invoker = true) as
  select test, count(*) as tests_finished, count(distinct anon_id) as people,
         round(avg(pct)) as avg_pct, round(100.0 * avg((pct >= 80)::int)) as pct_scoring_80_plus,
         round(avg(level_end), 1) as avg_level_reached
  from results group by 1;

create view inbox_results with (security_invoker = true) as
  select s.email, s.confirmed, s.stopped, count(c.id) as links_clicked, max(c.created_at) as last_click
  from inbox_signups s left join inbox_clicks c on c.code = s.code
  group by 1, 2, 3;
