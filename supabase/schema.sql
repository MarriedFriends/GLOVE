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
  smoking        text check (smoking in ('none','vape','smoker')),
  date_freq      text check (date_freq in ('daily','often','weekly','rarely')),
  military       text check (military in ('served','not_yet','exempt','na')),
  style          text check (style in
                   ('pure','chic','cute','hip','dandy','lovely','vintage','natural')),
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
  add column if not exists hobbies text[] not null default '{}',
  add column if not exists smoking text check (smoking in ('none','vape','smoker')),
  add column if not exists date_freq text check (date_freq in ('daily','often','weekly','rarely')),
  add column if not exists military text check (military in ('served','not_yet','exempt','na')),
  add column if not exists style text check (style in
    ('pure','chic','cute','hip','dandy','lovely','vintage','natural'));
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
  nonsmoker_only     boolean not null default false,
  military_only      boolean not null default false,
  pref_date_freqs    text[] not null default '{}',   -- empty = any frequency
  pref_styles        text[] not null default '{}',   -- empty = no style bonus
  updated_at         timestamptz not null default now(),
  primary key (user_id, mode),
  check (min_age <= max_age),
  check (min_admission_year <= max_admission_year),
  check (min_height_idx <= max_height_idx)
);

alter table public.match_preferences
  add column if not exists nonsmoker_only boolean not null default false,
  add column if not exists military_only boolean not null default false,
  add column if not exists pref_date_freqs text[] not null default '{}',
  add column if not exists pref_styles text[] not null default '{}';

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
  content    text,                       -- null for voice messages
  audio_path text,                       -- storage path of a modulated voice note
  created_at timestamptz not null default now(),
  constraint messages_content_or_audio check (
    (content is not null and char_length(content) between 1 and 2000)
    or audio_path is not null
  )
);

-- Voice-message columns added after the first release — bring existing
-- databases up to date.
alter table public.messages add column if not exists audio_path text;
alter table public.messages alter column content drop not null;
alter table public.messages drop constraint if exists messages_content_check;
alter table public.messages drop constraint if exists messages_content_or_audio;
alter table public.messages add constraint messages_content_or_audio check (
  (content is not null and char_length(content) between 1 and 2000)
  or audio_path is not null
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
-- You can create your own likes, see the ones you sent, and see the ones you
-- RECEIVED (so you can accept them — this reveals the liker to the recipient,
-- a deliberate product decision).
-- You can't send likes while you're inside a live (48h) chat.
drop policy if exists "Create own likes" on public.likes;
create policy "Create own likes"
  on public.likes for insert
  to authenticated
  with check (
    liker_id = (select auth.uid())
    and not exists (
      select 1 from public.matches m
      where m.status = 'active'
        and m.created_at > now() - interval '48 hours'
        and (select auth.uid()) in (m.user_low, m.user_high)
    )
  );

drop policy if exists "Read own likes" on public.likes;
create policy "Read own likes"
  on public.likes for select
  to authenticated
  using (liker_id = (select auth.uid()));

drop policy if exists "Read likes received" on public.likes;
create policy "Read likes received"
  on public.likes for select
  to authenticated
  using (likee_id = (select auth.uid()) and is_like);

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

-- Send a message only as yourself, into an active match you belong to that
-- hasn't passed its 48-hour lifetime, and only if neither side blocked the
-- other.
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
        and m.created_at > now() - interval '48 hours'
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
-- One chat at a time: no match is created while either person is inside a
-- live (48h) chat — the like stays recorded and can connect later.
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
    select 1 from public.matches m
    where m.status = 'active'
      and m.created_at > now() - interval '48 hours'
      and (new.liker_id in (m.user_low, m.user_high)
        or new.likee_id in (m.user_low, m.user_high))
  ) then
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
drop function if exists public.find_candidates(int);
create function public.find_candidates(max_results int default 5)
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
  smoking        text,
  date_freq      text,
  military       text,
  style          text,
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
           mp.face_types as pref_faces,
           mp.nonsmoker_only, mp.military_only,
           mp.pref_date_freqs, mp.pref_styles
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
    c.smoking,
    c.date_freq,
    c.military,
    c.style,
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
      + case when c.style is not null and c.style = any(me.pref_styles)
             then 10 else 0 end
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
    and (not me.nonsmoker_only or c.smoking = 'none')
    and (not me.military_only or c.military = 'served')
    and (coalesce(cardinality(me.pref_date_freqs), 0) = 0
         or c.date_freq = any(me.pref_date_freqs))
    -- One chat at a time: skip candidates currently inside a live chat.
    and not exists (
      select 1 from public.matches mb
      where c.id in (mb.user_low, mb.user_high)
        and mb.status = 'active'
        and mb.created_at > now() - interval '48 hours'
    )
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
  order by 15 desc, c.created_at desc
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

drop function if exists public.get_daily_candidates();
create function public.get_daily_candidates()
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
  smoking        text,
  date_freq      text,
  military       text,
  style          text,
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
    from public.find_candidates(50) fc
    where fc.candidate_id not in (
      select dp2.candidate_id
      from public.daily_picks dp2
      where dp2.user_id = uid and dp2.pick_date = today
    )
    -- People who already liked me jump the queue (they stay anonymous —
    -- they simply appear among my daily picks), then highest score first.
    order by
      exists (
        select 1 from public.likes l
        where l.liker_id = fc.candidate_id
          and l.likee_id = uid
          and l.is_like
      ) desc,
      fc.score desc
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
    c.smoking,
    c.date_freq,
    c.military,
    c.style,
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
  where dp.user_id = uid
    and dp.pick_date = today
    -- Hide picks who entered a live chat after this morning's selection.
    and not exists (
      select 1 from public.matches mb
      where c.id in (mb.user_low, mb.user_high)
        and mb.status = 'active'
        and mb.created_at > now() - interval '48 hours'
    )
  order by dp.score desc;
end;
$$;

revoke execute on function public.get_daily_candidates() from public, anon;
grant execute on function public.get_daily_candidates() to authenticated;

-- ===========================================================================
-- Question curriculum: staged icebreaker questions inside each chat.
--
-- Flow: a match's first question round is created by trigger. Each side
-- writes an answer into question_answers (row-per-user, so RLS can hide the
-- other's answer). When the second answer arrives, a trigger flips the round
-- to 'revealed' — clients subscribe to question_rounds via Realtime and both
-- screens reveal simultaneously. Passing is limited to 2 per user per match,
-- enforced server-side.
-- ===========================================================================
create table if not exists public.questions (
  id     int primary key,
  stage  int not null check (stage between 1 and 3),
  ord    int not null,
  prompt text not null,
  unique (stage, ord)
);

alter table public.questions enable row level security;

drop policy if exists "Questions readable" on public.questions;
create policy "Questions readable"
  on public.questions for select
  to authenticated
  using (true);

insert into public.questions (id, stage, ord, prompt) values
  (16, 1, 0, '만나서 반가워요! 먼저 간단한 자기소개 부탁해요 🙌 (분위기, 하는 일, 요즘 근황 등)'),
  (1, 1, 1, '요즘 가장 빠져있는 것은 무엇인가요?'),
  (2, 1, 2, '스트레스 받으면 어떻게 푸는 편이에요?'),
  (3, 1, 3, '최근에 가장 크게 웃었던 순간은 언제였어요?'),
  (4, 1, 4, '인생 최고의 맛집 하나만 소개한다면?'),
  (5, 1, 5, '주말을 완벽하게 보내는 나만의 방법은?'),
  (6, 2, 1, '연애에서 가장 중요하다고 생각하는 한 가지는?'),
  (7, 2, 2, '데이트로 영화관 vs 한강 산책, 어느 쪽? 이유는?'),
  (8, 2, 3, '상대방의 어떤 모습에 설레는 편인가요?'),
  (9, 2, 4, '갈등이 생기면 나는 어떻게 푸는 사람인가요?'),
  (10, 2, 5, '나를 성격으로 동물에 비유하면? (얼굴상 말고!)'),
  (11, 3, 1, '요즘 나의 가장 큰 고민은 무엇인가요?'),
  (12, 3, 2, '10년 뒤 나는 어떤 모습이었으면 좋겠어요?'),
  (13, 3, 3, '지금까지 받아본 최고의 위로는 무엇이었나요?'),
  (14, 3, 4, '나의 어떤 점이 연인에게 가장 좋은 선물이 될까요?'),
  (15, 3, 5, '서로 정체를 공개한다면 제일 먼저 뭘 하고 싶어요?')
on conflict (id) do nothing;

create table if not exists public.question_rounds (
  id             uuid primary key default gen_random_uuid(),
  match_id       uuid not null references public.matches (id) on delete cascade,
  question_id    int  not null references public.questions (id),
  round_no       int  not null,
  status         text not null default 'active'
                   check (status in ('active', 'revealed', 'passed')),
  low_submitted  boolean not null default false,   -- user_low answered (no content leaked)
  high_submitted boolean not null default false,
  low_next       boolean not null default false,   -- user_low pressed "다음"
  high_next      boolean not null default false,
  passed_by      uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  revealed_at    timestamptz,
  unique (match_id, round_no),
  unique (match_id, question_id)
);

alter table public.question_rounds
  add column if not exists low_next boolean not null default false,
  add column if not exists high_next boolean not null default false;

alter table public.question_rounds enable row level security;

drop policy if exists "Rounds readable by participants" on public.question_rounds;
create policy "Rounds readable by participants"
  on public.question_rounds for select
  to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = question_rounds.match_id
        and (select auth.uid()) in (m.user_low, m.user_high)
    )
  );
-- No INSERT/UPDATE policies: rounds change only via triggers and RPCs below.

create table if not exists public.question_answers (
  round_id     uuid not null references public.question_rounds (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  answer       text not null check (char_length(answer) between 1 and 500),
  submitted_at timestamptz not null default now(),
  primary key (round_id, user_id)
);

alter table public.question_answers enable row level security;

drop policy if exists "Submit own answer" on public.question_answers;
create policy "Submit own answer"
  on public.question_answers for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1
      from public.question_rounds qr
      join public.matches m on m.id = qr.match_id
      where qr.id = question_answers.round_id
        and qr.status = 'active'
        and m.status = 'active'
        and (select auth.uid()) in (m.user_low, m.user_high)
    )
  );

-- Your own answer is always visible; the other side's only after reveal.
drop policy if exists "Read own or revealed answers" on public.question_answers;
create policy "Read own or revealed answers"
  on public.question_answers for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1
      from public.question_rounds qr
      join public.matches m on m.id = qr.match_id
      where qr.id = question_answers.round_id
        and qr.status = 'revealed'
        and (select auth.uid()) in (m.user_low, m.user_high)
    )
  );

-- First question appears the moment a match is created.
create or replace function public.start_first_question()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.question_rounds (match_id, question_id, round_no)
  select new.id, q.id, 1
  from public.questions q
  order by q.stage, q.ord
  limit 1
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_match_created on public.matches;
create trigger on_match_created
  after insert on public.matches
  for each row execute function public.start_first_question();

-- Mark submission flags; reveal when both sides are in.
create or replace function public.handle_answer_submitted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_low uuid;
  v_high uuid;
begin
  select m.user_low, m.user_high into v_low, v_high
  from public.question_rounds qr
  join public.matches m on m.id = qr.match_id
  where qr.id = new.round_id;

  if new.user_id = v_low then
    update public.question_rounds set low_submitted = true where id = new.round_id;
  elsif new.user_id = v_high then
    update public.question_rounds set high_submitted = true where id = new.round_id;
  end if;

  update public.question_rounds
  set status = 'revealed', revealed_at = now()
  where id = new.round_id
    and status = 'active'
    and low_submitted
    and high_submitted;

  return new;
end;
$$;

drop trigger if exists on_answer_submitted on public.question_answers;
create trigger on_answer_submitted
  after insert on public.question_answers
  for each row execute function public.handle_answer_submitted();

-- The system drives the curriculum by itself: clients call this on chat
-- silence, and the function decides. A question left unanswered for 10+
-- minutes is expired (passed_by null = skipped by the system, not a user)
-- so the conversation is never stuck on one card.
create or replace function public.request_next_question(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id
      and m.status = 'active'
      and m.created_at > now() - interval '48 hours'
      and uid in (m.user_low, m.user_high)
  ) then
    raise exception 'not a participant of this match';
  end if;

  -- Expire a stale, uncompleted question after 10 minutes.
  update public.question_rounds
  set status = 'passed', revealed_at = now()
  where match_id = p_match_id
    and status = 'active'
    and created_at < now() - interval '10 minutes';

  if exists (
    select 1 from public.question_rounds qr
    where qr.match_id = p_match_id and qr.status = 'active'
  ) then
    return;
  end if;

  insert into public.question_rounds (match_id, question_id, round_no)
  select p_match_id, q.id,
         coalesce((select max(qr2.round_no)
                   from public.question_rounds qr2
                   where qr2.match_id = p_match_id), 0) + 1
  from public.questions q
  where q.id not in (
    select qr3.question_id from public.question_rounds qr3
    where qr3.match_id = p_match_id
  )
  order by q.stage, q.ord
  limit 1
  on conflict do nothing;
end;
$$;

revoke execute on function public.request_next_question(uuid) from public, anon;
grant execute on function public.request_next_question(uuid) to authenticated;

-- The user-pass system was removed — the system advances questions itself.
drop function if exists public.pass_question(uuid);

-- "다음" vote: after a round is revealed, each side can press 다음. When BOTH
-- have pressed, the next question fires immediately (no need to wait for the
-- silence timer).
create or replace function public.ready_for_next(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  v_low uuid;
  v_high uuid;
  v_round_id uuid;
begin
  select m.user_low, m.user_high into v_low, v_high
  from public.matches m
  where m.id = p_match_id
    and m.status = 'active'
    and uid in (m.user_low, m.user_high);
  if v_low is null then
    raise exception 'not a participant of this match';
  end if;

  -- Can't skip ahead while a question is still open.
  if exists (
    select 1 from public.question_rounds qr
    where qr.match_id = p_match_id and qr.status = 'active'
  ) then
    return;
  end if;

  select qr.id into v_round_id
  from public.question_rounds qr
  where qr.match_id = p_match_id and qr.status in ('revealed', 'passed')
  order by qr.round_no desc
  limit 1;

  if v_round_id is null then
    perform public.request_next_question(p_match_id);
    return;
  end if;

  if uid = v_low then
    update public.question_rounds set low_next = true where id = v_round_id;
  else
    update public.question_rounds set high_next = true where id = v_round_id;
  end if;

  if exists (
    select 1 from public.question_rounds qr
    where qr.id = v_round_id and qr.low_next and qr.high_next
  ) then
    perform public.request_next_question(p_match_id);
  end if;
end;
$$;

revoke execute on function public.ready_for_next(uuid) from public, anon;
grant execute on function public.ready_for_next(uuid) to authenticated;

-- Stream round changes (new question, both-submitted reveal, pass) live.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'question_rounds'
  ) then
    alter publication supabase_realtime add table public.question_rounds;
  end if;
end $$;

-- ===========================================================================
-- Contact exchange: after a chat's 48 hours end, each side may share their
-- Instagram/KakaoTalk. A shared contact becomes visible to the other person
-- only once THEY have shared too (mutual reveal, same spirit as questions).
-- ===========================================================================
create table if not exists public.contact_reveals (
  match_id   uuid not null references public.matches (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  contact    text not null check (char_length(contact) between 1 and 100),
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

alter table public.contact_reveals enable row level security;

-- Helper (security definer) so the select policy can check "did I share?"
-- without recursing into its own RLS.
create or replace function public.has_shared_contact(p_match_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.contact_reveals cr
    where cr.match_id = p_match_id and cr.user_id = p_user_id
  );
$$;

revoke execute on function public.has_shared_contact(uuid, uuid) from public, anon;
grant execute on function public.has_shared_contact(uuid, uuid) to authenticated;

drop policy if exists "Share own contact after chat ends" on public.contact_reveals;
create policy "Share own contact after chat ends"
  on public.contact_reveals for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.matches m
      where m.id = contact_reveals.match_id
        and m.status = 'active'
        and m.created_at <= now() - interval '48 hours'
        and (select auth.uid()) in (m.user_low, m.user_high)
    )
  );

drop policy if exists "Read contacts mutually" on public.contact_reveals;
create policy "Read contacts mutually"
  on public.contact_reveals for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (
      exists (
        select 1 from public.matches m
        where m.id = contact_reveals.match_id
          and (select auth.uid()) in (m.user_low, m.user_high)
      )
      and public.has_shared_contact(contact_reveals.match_id, (select auth.uid()))
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'contact_reveals'
  ) then
    alter publication supabase_realtime add table public.contact_reveals;
  end if;
end $$;

-- ===========================================================================
-- Storage: private bucket for (already-modulated) voice messages.
-- Files live at <match_id>/<uuid>.wav; only the two participants of that
-- match may upload or read them. Voices are pitch-shifted ON THE CLIENT
-- before upload, so the original voice never reaches the server.
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('voice-messages', 'voice-messages', false)
on conflict (id) do nothing;

drop policy if exists "Voice upload by participants" on storage.objects;
create policy "Voice upload by participants"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'voice-messages'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and m.status = 'active'
        and (select auth.uid()) in (m.user_low, m.user_high)
    )
  );

drop policy if exists "Voice read by participants" on storage.objects;
create policy "Voice read by participants"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'voice-messages'
    and exists (
      select 1 from public.matches m
      where m.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (m.user_low, m.user_high)
    )
  );

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
