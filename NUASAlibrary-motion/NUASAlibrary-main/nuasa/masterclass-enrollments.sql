-- Run once in Supabase: SQL Editor > New query > paste > Run. Safe to run again.
-- Who has paid for which masterclass, and until when. Students can only READ their own row.
-- Only admins (through the functions below) or your server can write, so nobody can give themselves access.

create table if not exists public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_code text not null,
  expires_at timestamptz,            -- null = no end date
  paid_at timestamptz not null default now(),
  unique (user_id, course_code)
);
alter table public.enrollments enable row level security;

drop policy if exists "read own enrollments" on public.enrollments;
create policy "read own enrollments" on public.enrollments for select using (auth.uid() = user_id);

-- uses the admin check your project already has (public.nuasa_is_admin)
drop policy if exists "admins read enrollments" on public.enrollments;
create policy "admins read enrollments" on public.enrollments for select using (public.nuasa_is_admin());

-- Approve (or renew) a student by email. Adds p_days to whichever is later: today or their current end date.
create or replace function public.nuasa_enroll(p_email text, p_course text, p_days int default 30)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; cur timestamptz; new_end timestamptz;
begin
  if not public.nuasa_is_admin() then raise exception 'Admins only'; end if;
  if p_days is null or p_days < 1 or p_days > 400 then raise exception 'Days must be between 1 and 400'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return 'NO_USER'; end if;
  select expires_at into cur from public.enrollments where user_id = uid and course_code = p_course;
  new_end := greatest(coalesce(cur, now()), now()) + make_interval(days => p_days);
  insert into public.enrollments (user_id, course_code, expires_at) values (uid, p_course, new_end)
    on conflict (user_id, course_code) do update set expires_at = new_end, paid_at = now();
  return to_char(new_end, 'YYYY-MM-DD');
end $$;

create or replace function public.nuasa_unenroll(p_email text, p_course text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.nuasa_is_admin() then raise exception 'Admins only'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return 'NO_USER'; end if;
  delete from public.enrollments where user_id = uid and course_code = p_course;
  return 'REMOVED';
end $$;

revoke all on function public.nuasa_enroll(text, text, int) from public, anon;
revoke all on function public.nuasa_unenroll(text, text) from public, anon;
grant execute on function public.nuasa_enroll(text, text, int) to authenticated;
grant execute on function public.nuasa_unenroll(text, text) to authenticated;
