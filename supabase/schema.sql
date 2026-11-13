-- ==============================================================================
-- LearnMyWay Supabase Database Schema
-- Run this script in the Supabase Dashboard SQL Editor (SQL Editor -> New Query)
-- ==============================================================================

-- 1. Create the `profiles` table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  education_level text default 'High School',
  learning_interests text[] default '{}',
  created_at timestamptz default timezone('utc'::text, now()) not null,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

-- 2. Enable Row Level Security (RLS) on `profiles`
alter table public.profiles enable row level security;

-- 3. Row Level Security Policies for `profiles`
-- Students can only view their own profile
drop policy if exists "Students can view own profile" on public.profiles;
create policy "Students can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

-- Students can only update their own profile
drop policy if exists "Students can update own profile" on public.profiles;
create policy "Students can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Students can insert their own profile
drop policy if exists "Students can insert own profile" on public.profiles;
create policy "Students can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- 4. Automatic Profile Creation Trigger
-- When a user registers via auth.users, automatically create a row in profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    now(),
    now()
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      updated_at = now();
  return new;
end;
$$;

-- Trigger to execute after each new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5. Create `saved_lessons` table for student history and bookmarking
create table if not exists public.saved_lessons (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  interest text not null,
  topic text not null,
  lesson text not null,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

-- 6. Enable Row Level Security on `saved_lessons`
alter table public.saved_lessons enable row level security;

-- Policies for `saved_lessons`
drop policy if exists "Students can view own saved lessons" on public.saved_lessons;
create policy "Students can view own saved lessons"
  on public.saved_lessons
  for select
  using (auth.uid() = user_id);

drop policy if exists "Students can insert own saved lessons" on public.saved_lessons;
create policy "Students can insert own saved lessons"
  on public.saved_lessons
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Students can delete own saved lessons" on public.saved_lessons;
create policy "Students can delete own saved lessons"
  on public.saved_lessons
  for delete
  using (auth.uid() = user_id);

-- 7. High-Concurrency Indexes for Fast Student Dashboard Queries
create index if not exists idx_saved_lessons_user_created
  on public.saved_lessons (user_id, created_at desc);

-- 8. Unified Application Analytics Table (`analytics_events`)
create table if not exists public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  page_path text default '/',
  topic text,
  interest text,
  academic_subject text,
  education_level text,
  ai_model text,
  device_type text default 'Desktop',
  os_name text,
  browser_name text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create index if not exists idx_analytics_events_created_at
  on public.analytics_events (created_at desc);

alter table public.analytics_events enable row level security;

drop policy if exists "Anyone can insert analytics events" on public.analytics_events;
create policy "Anyone can insert analytics events"
  on public.analytics_events
  for insert
  with check (true);

drop policy if exists "Anyone can view analytics events" on public.analytics_events;
create policy "Anyone can view analytics events"
  on public.analytics_events
  for select
  using (true);


