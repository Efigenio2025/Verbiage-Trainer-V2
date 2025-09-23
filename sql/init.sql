-- Create the profiles table tied to auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'employee',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Automatically create or refresh a profile when a user signs up
drop trigger if exists on_auth_user_created on auth.users;
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Maintain updated_at on profile changes
drop trigger if exists on_profile_updated on public.profiles;
create or replace function public.touch_profiles_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.touch_profiles_updated_at();

alter table public.profiles enable row level security;

-- Users may view and update their own profile
create policy if not exists "Profiles can be viewed by owner"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy if not exists "Profiles can be updated by owner"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins may view all profiles
create policy if not exists "Admins can view all profiles"
  on public.profiles
  for select
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );
