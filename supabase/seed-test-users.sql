-- ===========================================================================
-- TEST DATA ONLY — creates 40 fake, pre-confirmed accounts (20 male / 20
-- female) with random survey answers, for exercising the matching screens.
--
-- Run in the Supabase SQL editor. Re-runnable (skips existing seed emails).
-- These accounts exist for matching/display; they are not meant to log in.
--
-- To remove all of them later, run the DELETE at the bottom of this file.
-- ===========================================================================

do $$
declare
  i int;
  uid uuid;
  seed_email text;
  g text;
  heights text[] := array['~150','151~155','156~160','161~165','166~170',
                          '171~175','176~180','181~185','186~190','190~'];
  faces text[] := array['dog','cat','fox','snake','mouse','bear','rabbit'];
  hobby_pool text[] := array['운동·헬스','러닝','등산','축구·풋살','영화',
    '드라마·예능','음악 감상','노래방','악기 연주','게임','보드게임','독서',
    '여행','맛집 탐방','카페 투어','사진','요리·베이킹','전시·공연','댄스',
    '반려동물'];
  picked_hobbies text[];
  h_idx int;
begin
  for i in 1..40 loop
    g := case when i <= 20 then 'male' else 'female' end;
    seed_email := format('glove309e+seed%s@gmail.com', lpad(i::text, 2, '0'));

    -- Skip if this seed already exists (makes the script re-runnable).
    if exists (select 1 from auth.users where email = seed_email) then
      continue;
    end if;

    uid := gen_random_uuid();

    -- 1) Auth user, already e-mail-confirmed. The on_auth_user_created
    --    trigger will auto-create the profile stub.
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', uid,
      'authenticated', 'authenticated', seed_email,
      extensions.crypt('GloveSeed!23', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now()
    );

    -- Height: mildly gender-weighted bucket (women 150~180, men 161~190+).
    h_idx := case when g = 'male'
                  then 4 + floor(random() * 7)::int   -- 4..10
                  else 1 + floor(random() * 7)::int   -- 1..7
             end;

    -- 3 distinct random hobbies.
    select array_agg(h) into picked_hobbies
    from (select unnest(hobby_pool) as h order by random() limit 3) s;

    -- 2) Fill the profile with random survey answers.
    update public.profiles set
      handle         = 'seed_' || lpad(i::text, 2, '0'),
      university     = 'gmail.com',          -- same "school" as real test accounts
      gender         = g,
      birth_year     = 1996 + floor(random() * 12)::int,   -- age ≈ 19~30
      admission_year = 2015 + floor(random() * 12)::int,   -- 15~26학번
      height_range   = heights[h_idx],
      face_type      = faces[1 + floor(random() * 7)::int],
      mbti           = substr('IE', 1 + floor(random() * 2)::int, 1)
                    || substr('NS', 1 + floor(random() * 2)::int, 1)
                    || substr('TF', 1 + floor(random() * 2)::int, 1)
                    || substr('PJ', 1 + floor(random() * 2)::int, 1),
      hobbies        = picked_hobbies,
      is_verified    = true,
      is_active      = true
    where id = uid;

    -- 3) Wide-open date preferences, so mutual-fit scoring kicks in.
    insert into public.match_preferences (
      user_id, mode, min_age, max_age, min_admission_year, max_admission_year,
      same_university, min_height_idx, max_height_idx, face_types, hobby, intro
    ) values (
      uid, 'date', 19, 30, 2015, 2026,
      false, 0, 9,
      array['dog','cat','fox','snake','mouse','bear','rabbit'],
      hobby_pool[1 + floor(random() * 20)::int],
      '안녕하세요! 좋은 인연을 찾고 있어요. 반가워요 :)'
    )
    on conflict (user_id, mode) do nothing;
  end loop;
end $$;

-- Sanity check — should return 40 rows (20 male / 20 female).
select gender, count(*) from public.profiles
where handle like 'seed_%'
group by gender;

-- ===========================================================================
-- CLEANUP (run only when you want to delete every seed account):
--
--   delete from auth.users where email like 'glove309e+seed%@gmail.com';
--
-- (Deleting auth.users cascades to profiles, likes, matches, messages,
--  and match_preferences automatically.)
-- ===========================================================================
