-- ===========================================================================
-- TEST HELPER — make every seed account I liked "like me back".
--
-- Run this in the SQL editor AFTER you press 좋아요 on some seed accounts in
-- the app. The mutual-like trigger then creates the matches, so they appear
-- in 내 매칭 and you can test the chat.
-- ===========================================================================
insert into public.likes (liker_id, likee_id, is_like)
select l.likee_id, l.liker_id, true
from public.likes l
join public.profiles seed on seed.id = l.likee_id
where seed.handle like 'seed_%'
  and l.is_like
on conflict (liker_id, likee_id) do nothing;

-- Check the result — your new matches:
select m.id, p.handle as matched_with, m.created_at
from public.matches m
join public.profiles p on p.id in (m.user_low, m.user_high)
where p.handle like 'seed_%'
  and m.status = 'active'
order by m.created_at desc;
