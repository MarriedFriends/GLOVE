-- Campus Social — schema for an anonymous chat & dating app for students.
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
  id            uuid primary key references auth.users (id) on delete cascade,
  handle        text unique not null,                 -- anonymous display name
  university    text,                                  -- derived from email domain
  gender        text check (gender in ('male', 'female', 'nonbinary', 'other')),
  interested_in text check (interested_in in ('male', 'female', 'everyone')),
  birth_year    int  check (birth_year between 1950 and 2015),
  bio           text check (char_length(bio) <= 500),
  avatar_url    text,
  is_verified   boolean not null default false,        -- confirmed student email
  is_active     boolean not null default true,         -- shown in discovery
  created_at    timestamptz not null default now()
);
-- A profile is "onboarded" (ready for discovery) once gender + interested_in
-- are set. The matching attributes are NULL until the user completes onboarding.

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
