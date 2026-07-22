-- Glove — schema for an anonymous chat & dating app for students.
--
-- Run in the Supabase SQL editor (or `supabase db push`). This script is
-- re-runnable: policies are dropped before being recreated.
--
-- DESIGN: anonymity by column separation.
--   - `profiles` holds ONLY anonymous, safe-to-show fields (handle + matching
--     attributes). It never holds real name or email.
--   - The verified email / real identity stays in `auth.users`, which Supabase
--     never exposes to other users through the API. Keep it that way.
--   RLS is row-level, not column-level — so the only reliable way to keep
--   identity hidden is to not store identifying columns in a readable table.

-- One-time cleanup of the old scaffolding model (safe in early dev).
drop table if exists public.posts cascade;

-- ===========================================================================
-- profiles: the anonymous, public-facing identity used for matching & chat.
-- ===========================================================================
create table if not exists public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  handle         text unique not null,                 -- anonymous display name
  university     text,                                  -- derived from email domain
  gender         text check (gender in ('male', 'female', 'nonbinary', 'other')),
  interested_in  text check (interested_in in ('male', 'female', 'everyone')),
  birth_year     int  check (birth_year between 1950 and 2015),
  admission_year int  check (admission_year between 2000 and 2035),  -- 학번 (e.g. 2023 = 23학번)
  height_range   text check (height_range in
                   ('~150','151~155','156~160','161~165','166~170',
                    '171~175','176~180','181~185','186~190','190~')),
  face_type      text check (face_type in
                   ('dog','cat','fox','snake','mouse','bear','rabbit')),
  mbti           text check (mbti ~ '^[IE][NS][TF][PJ]$'),
  hobbies        text[] not null default '{}',
  bio            text check (char_length(bio) <= 500),
  avatar_url     text,
  is_verified    boolean not null default false,        -- confirmed student email
  is_active      boolean not null default true,         -- shown in discovery
  created_at     timestamptz not null default now()
);

-- Survey columns added after the first release — bring existing databases up
-- to date. (ADD COLUMN IF NOT EXISTS is a no-op when the column exists.)
alter table public.profiles
  add column if not exists admission_year int check (admission_year between 2000 and 2035),
  add column if not exists height_range text check (height_range in
    ('~150','151~155','156~160','161~165','166~170',
     '171~175','176~180','181~185','186~190','190~')),
  add column if not exists face_type text check (face_type in
    ('dog','cat','fox','snake','mouse','bear','rabbit')),
  add column if not exists mbti text check (mbti ~ '^[IE][NS][TF][PJ]$'),
  add column if not exists hobbies text[] not null default '{}';
-- A profile is "onboarded" (ready for discovery) once gender + interested_in
-- are set. The matching attributes are NULL until the user completes onboarding.

-- ===========================================================================
-- match_preferences: what a user is looking for (the "찾기" wizard answers).
-- One row per (user, mode) so a future friend-finding mode needs no migration.
-- height indexes refer to the HEIGHT_BUCKETS list in
-- src/lib/onboarding-options.ts (0 = '~150' … 9 = '190~').
-- ===========================================================================
create table if not exists public.match_preferences (
  user_id            uuid not null references public.profiles (id) on delete cascade,
  mode               text not null default 'date' check (mode in ('date', 'friend')),
  min_age            int not null check (min_age between 19 and 30),
  max_age            int not null check (max_age between 19 and 30),
  min_admission_year int not null check (min_admission_year between 2000 and 2035),
  max_admission_year int not null check (max_admission_year between 2000 and 2035),
  same_university    boolean not null default true,
  min_height_idx     int not null check (min_height_idx between 0 and 9),
  max_height_idx     int not null check (max_height_idx between 0 and 9),
  face_types         text[] not null default '{}',
  hobby              text,
  intro              text not null check (char_length(intro) between 10 and 80),
  updated_at         timestamptz not null default now(),
  primary key (user_id, mode),
  check (min_age <= max_age),
  check (min_admission_year <= max_admission_year),
  check (min_height_idx <= max_height_idx)
);

alter table public.match_preferences enable row level security;

drop policy if exists "Manage own preferences" on public.match_preferences;
create policy "Manage own preferences"
  on public.match_preferences for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ===========================================================================
-- likes: directional swipe. A mutual positive like creates a match (trigger).
-- ===========================================================================
create table if not exists public.likes (
  liker_id   uuid not null references public.profiles (id) on delete cascade,
  likee_id   uuid not null references public.profiles (id) on delete cascade,
  is_like    boolean not null default true,            -- true = like, false = pass
  created_at timestamptz not null default now(),
  primary key (liker_id, likee_id),
  check (liker_id <> likee_id)
);
create index if not exists likes_likee_idx on public.likes (likee_id);

-- ===========================================================================
-- matches: created automatically on a mutual like. Users never insert directly.
-- The pair is stored ordered (user_low < user_high) so a match is unique.
-- ===========================================================================
create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  user_low   uuid not null references public.profiles (id) on delete cascade,
  user_high  uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'active' check (status in ('active', 'unmatched')),
  created_at timestamptz not null default now(),
  unique (user_low, user_high),
  check (user_low < user_high)
);
create index if not exists matches_user_high_idx on public.matches (user_high);

-- ===========================================================================
-- messages: chat within a match. Streamed to clients via Supabase Realtime.
-- ===========================================================================
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references public.matches (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_match_created_idx
  on public.messages (match_id, created_at desc);

-- ===========================================================================
-- blocks & reports: safety primitives.
-- ===========================================================================
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_id uuid not null references public.profiles (id) on delete cascade,
  reason      text not null
                check (reason in ('harassment', 'spam', 'inappropriate', 'fake', 'other')),
  details     text check (char_length(details) <= 1000),
  created_at  timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.profiles enable row level security;
alter table public.likes    enable row level security;
alter table public.matches  enable row level security;
alter table public.messages enable row level security;
alter table public.blocks   enable row level security;
alter table public.reports  enable row level security;

-- --- profiles -------------------------------------------------------------
-- You can always see your own profile. You can see others only if they are
-- active and neither of you has blocked the other.
drop policy if exists "Read own or non-blocked active profiles" on public.profiles;
create policy "Read own or non-blocked active profiles"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    or (
      is_active
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = (select auth.uid()) and b.blocked_id = profiles.id)
           or (b.blocker_id = profiles.id and b.blocked_id = (select auth.uid()))
      )
    )
  );

drop policy if exists "Insert own profile" on public.profiles;
create policy "Insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

drop policy if exists "Update own profile" on public.profiles;
create policy "Update own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- --- likes ----------------------------------------------------------------
-- You can create your own likes and see only the ones you sent. You must NOT
-- be able to see who liked you before a match forms.
drop policy if exists "Create own likes" on public.likes;
create policy "Create own likes"
  on public.likes for insert
  to authenticated
  with check (liker_id = (select auth.uid()));

drop policy if exists "Read own likes" on public.likes;
create policy "Read own likes"
  on public.likes for select
  to authenticated
  using (liker_id = (select auth.uid()));

-- --- matches --------------------------------------------------------------
-- Only participants can see a match. There is intentionally no INSERT policy:
-- matches are created by the security-definer trigger below, not by clients.
drop policy if exists "Read own matches" on public.matches;
create policy "Read own matches"
  on public.matches for select
  to authenticated
  using ((select auth.uid()) in (user_low, user_high));

-- A participant may unmatch (status -> 'unmatched'), nothing else.
drop policy if exists "Update own matches" on public.matches;
create policy "Update own matches"
  on public.matches for update
  to authenticated
  using ((select auth.uid()) in (user_low, user_high))
  with check ((select auth.uid()) in (user_low, user_high));

-- --- messages -------------------------------------------------------------
-- Read messages only in your active matches.
drop policy if exists "Read messages in own active matches" on public.messages;
create policy "Read messages in own active matches"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = messages.match_id
        and m.status = 'active'
        and (select auth.uid()) in (m.user_low, m.user_high)
    )
  );

-- Send a message only as yourself, into an active match you belong to, and
-- only if neither participant has blocked the other.
drop policy if exists "Send messages in own active matches" on public.messages;
create policy "Send messages in own active matches"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = (select auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = match_id
        and m.status = 'active'
        and (select auth.uid()) in (m.user_low, m.user_high)
        and not exists (
          select 1 from public.blocks b
          where (b.blocker_id = m.user_low  and b.blocked_id = m.user_high)
             or (b.blocker_id = m.user_high and b.blocked_id = m.user_low)
        )
    )
  );

-- --- blocks ---------------------------------------------------------------
drop policy if exists "Manage own blocks" on public.blocks;
create policy "Manage own blocks"
  on public.blocks for all
  to authenticated
  using (blocker_id = (select auth.uid()))
  with check (blocker_id = (select auth.uid()));

-- --- reports --------------------------------------------------------------
drop policy if exists "Create own reports" on public.reports;
create policy "Create own reports"
  on public.reports for insert
  to authenticated
  with check (reporter_id = (select auth.uid()));

drop policy if exists "Read own reports" on public.reports;
create policy "Read own reports"
  on public.reports for select
  to authenticated
  using (reporter_id = (select auth.uid()));

-- ===========================================================================
-- Triggers
-- ===========================================================================

-- On sign-up: create an anonymous profile stub. We derive the university from
-- the email domain but do NOT copy the email or any name into `profiles`.
-- The user completes the rest (real handle, gender, preferences) at onboarding.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, handle, university)
  values (
    new.id,
    'user_' || substr(replace(new.id::text, '-', ''), 1, 10),
    nullif(split_part(coalesce(new.email, ''), '@', 2), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- On a positive like: if the other person already liked back, create the match.
-- Runs as security definer so it can write `matches` even though clients can't.
create or replace function public.handle_like()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_like is not true then
    return new;
  end if;

  if exists (
    select 1 from public.likes l
    where l.liker_id = new.likee_id
      and l.likee_id = new.liker_id
      and l.is_like is true
  ) then
    insert into public.matches (user_low, user_high)
    values (least(new.liker_id, new.likee_id), greatest(new.liker_id, new.likee_id))
    on conflict (user_low, user_high) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_like_created on public.likes;
create trigger on_like_created
  after insert on public.likes
  for each row execute function public.handle_like();

-- ===========================================================================
-- Matching: find_candidates() — the "AI 매칭" level-1 engine.
--
-- Runs entirely server-side (security definer) because it must read other
-- users' private match_preferences to apply mutual filters; it returns ONLY
-- anonymous, safe-to-show fields plus a compatibility score (max 100):
--   +30  candidate's face type is one I want
--   +30  shared hobbies (10 per overlap, capped)
--   +20  MBTI chemistry (same N/S +8; complementary E/I, T/F, P/J +4 each)
--   +20  I also satisfy THEIR saved filters (mutual fit)
-- ===========================================================================
create or replace function public.find_candidates(max_results int default 5)
returns table (
  candidate_id   uuid,
  handle         text,
  university     text,
  age            int,
  admission_year int,
  height_range   text,
  face_type      text,
  mbti           text,
  hobbies        text[],
  intro          text,
  score          int
)
language sql
stable
security definer
set search_path = ''
as $$
  with height_order as (
    select array['~150','151~155','156~160','161~165','166~170',
                 '171~175','176~180','181~185','186~190','190~']::text[] as arr
  ),
  me as (
    select p.id, p.gender, p.university, p.birth_year, p.admission_year,
           p.height_range, p.face_type, p.mbti, p.hobbies,
           mp.min_age, mp.max_age, mp.min_admission_year, mp.max_admission_year,
           mp.same_university, mp.min_height_idx, mp.max_height_idx,
           mp.face_types as pref_faces
    from public.profiles p
    join public.match_preferences mp
      on mp.user_id = p.id and mp.mode = 'date'
    where p.id = (select auth.uid())
  )
  select
    c.id,
    c.handle,
    c.university,
    extract(year from now())::int - c.birth_year,
    c.admission_year,
    c.height_range,
    c.face_type,
    c.mbti,
    c.hobbies,
    cmp.intro,
    (
      case when c.face_type = any(me.pref_faces) then 30 else 0 end
      + least(30, 10 * (select count(*)::int
                        from unnest(me.hobbies) as mh
                        where mh = any(c.hobbies)))
      + case when substr(me.mbti, 2, 1) = substr(c.mbti, 2, 1) then 8 else 0 end
      + case when substr(me.mbti, 1, 1) <> substr(c.mbti, 1, 1) then 4 else 0 end
      + case when substr(me.mbti, 3, 1) <> substr(c.mbti, 3, 1) then 4 else 0 end
      + case when substr(me.mbti, 4, 1) <> substr(c.mbti, 4, 1) then 4 else 0 end
      + case when cmp.user_id is not null
              and (extract(year from now())::int - me.birth_year)
                    between cmp.min_age and cmp.max_age
              and me.admission_year
                    between cmp.min_admission_year and cmp.max_admission_year
              and (array_position(h.arr, me.height_range) - 1)
                    between cmp.min_height_idx and cmp.max_height_idx
              and (not cmp.same_university or me.university = c.university)
             then 20 else 0 end
    )::int
  from me
  cross join height_order h
  join public.profiles c on c.id <> me.id
  left join public.match_preferences cmp
    on cmp.user_id = c.id and cmp.mode = 'date'
  where c.is_active
    and c.birth_year is not null
    and c.admission_year is not null
    and c.height_range is not null
    and c.face_type is not null
    and c.mbti is not null
    and ((me.gender = 'male' and c.gender = 'female')
      or (me.gender = 'female' and c.gender = 'male'))
    and (extract(year from now())::int - c.birth_year)
          between me.min_age and me.max_age
    and c.admission_year
          between me.min_admission_year and me.max_admission_year
    and (array_position(h.arr, c.height_range) - 1)
          between me.min_height_idx and me.max_height_idx
    and (not me.same_university or c.university = me.university)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = me.id and b.blocked_id = c.id)
         or (b.blocker_id = c.id and b.blocked_id = me.id)
    )
    and not exists (
      select 1 from public.likes l
      where l.liker_id = me.id and l.likee_id = c.id
    )
    and not exists (
      select 1 from public.matches m
      where m.user_low = least(me.id, c.id)
        and m.user_high = greatest(me.id, c.id)
    )
  order by 11 desc, c.created_at desc
  limit max_results
$$;

revoke execute on function public.find_candidates(int) from public, anon;
grant execute on function public.find_candidates(int) to authenticated;

-- ===========================================================================
-- Daily picks: each user gets exactly 3 candidates per day, fixed until the
-- next 9:00 AM KST refresh. get_daily_candidates() generates (or tops up to)
-- today's set on first call of the day and returns the same set afterwards.
-- ===========================================================================
create table if not exists public.daily_picks (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  pick_date    date not null,                       -- key of the 9AM~9AM window
  candidate_id uuid not null references public.profiles (id) on delete cascade,
  score        int  not null default 0,
  created_at   timestamptz not null default now(),
  primary key (user_id, pick_date, candidate_id)
);

alter table public.daily_picks enable row level security;

drop policy if exists "Read own picks" on public.daily_picks;
create policy "Read own picks"
  on public.daily_picks for select
  to authenticated
  using (user_id = (select auth.uid()));
-- No INSERT policy: rows are written only by the security-definer function.

create or replace function public.get_daily_candidates()
returns table (
  candidate_id   uuid,
  handle         text,
  university     text,
  age            int,
  admission_year int,
  height_range   text,
  face_type      text,
  mbti           text,
  hobbies        text[],
  intro          text,
  score          int,
  liked          boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  -- The "day" flips at 09:00 Asia/Seoul: subtract 9h from KST local time.
  today date := ((now() at time zone 'Asia/Seoul') - interval '9 hours')::date;
  existing int;
begin
  select count(*) into existing
  from public.daily_picks dp
  where dp.user_id = uid and dp.pick_date = today;

  if existing < 3 then
    insert into public.daily_picks (user_id, pick_date, candidate_id, score)
    select uid, today, fc.candidate_id, fc.score
    from public.find_candidates(10) fc
    where fc.candidate_id not in (
      select dp2.candidate_id
      from public.daily_picks dp2
      where dp2.user_id = uid and dp2.pick_date = today
    )
    limit (3 - existing)
    on conflict do nothing;
  end if;

  return query
  select
    dp.candidate_id,
    c.handle,
    c.university,
    extract(year from now())::int - c.birth_year,
    c.admission_year,
    c.height_range,
    c.face_type,
    c.mbti,
    c.hobbies,
    cmp.intro,
    dp.score,
    exists (
      select 1 from public.likes l
      where l.liker_id = uid and l.likee_id = dp.candidate_id and l.is_like
    )
  from public.daily_picks dp
  join public.profiles c on c.id = dp.candidate_id
  left join public.match_preferences cmp
    on cmp.user_id = dp.candidate_id and cmp.mode = 'date'
  where dp.user_id = uid and dp.pick_date = today
  order by dp.score desc;
end;
$$;

revoke execute on function public.get_daily_candidates() from public, anon;
grant execute on function public.get_daily_candidates() to authenticated;

-- ===========================================================================
-- Realtime: stream new chat messages to connected clients.
-- ===========================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
