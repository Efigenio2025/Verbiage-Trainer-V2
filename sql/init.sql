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

-- De-ice scenario catalog managed by admins and consumed by employees
create table if not exists public.deice_scenarios (
  id text primary key,
  label text not null,
  description text,
  scenario jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by uuid references auth.users(id)
);

create or replace function public.touch_deice_scenarios_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  if auth.uid() is not null then
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists on_deice_scenarios_updated on public.deice_scenarios;
create trigger on_deice_scenarios_updated
  before insert or update on public.deice_scenarios
  for each row execute function public.touch_deice_scenarios_updated_at();

alter table public.deice_scenarios enable row level security;

create policy if not exists "Authenticated users can read de-ice scenarios"
  on public.deice_scenarios
  for select
  using (auth.role() = 'authenticated');

create policy if not exists "Admins can upsert de-ice scenarios"
  on public.deice_scenarios
  for insert
  with check (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

create policy if not exists "Admins can update de-ice scenarios"
  on public.deice_scenarios
  for update
  using (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles admin_profile
      where admin_profile.id = auth.uid()
        and admin_profile.role = 'admin'
    )
  );

insert into public.deice_scenarios (id, label, description, scenario)
values
  (
    'de-ice-default',
    'Runway 4L holdover rehearsal',
    'Baseline de-ice communications drill with captain callouts and iceman readbacks.',
    $$
    {
      "id": "de-ice-default",
      "label": "Runway 4L holdover rehearsal",
      "description": "Baseline de-ice communications drill with captain callouts and iceman readbacks.",
      "metadata": {
        "holdoverFluid": "Type IV",
        "holdoverStart": "05:12Z",
        "holdoverLimit": "05:42Z"
      },
      "steps": [
        {
          "role": "captain",
          "text": "Iceman, Polar 418 on stand 27. Request Type IV top-off for runway 4L departure.",
          "cue": "intro"
        },
        {
          "role": "iceman",
          "text": "Acknowledge service request and confirm anti-ice configuration.",
          "expected": [
            "Polar 418, Type IV application confirmed, wings and tail only, hold short runway 4L"
          ],
          "tags": ["acknowledge", "configuration"]
        },
        {
          "role": "captain",
          "text": "Verify anti-ice fluid, mix ratio, and start time.",
          "cue": "verify"
        },
        {
          "role": "iceman",
          "text": "Read back fluid type, mixture, and time stamp with NATO tail number.",
          "expected": [
            "Polar 418 heavy, anti-ice fluid Type IV neat, start time zero five one two zulu, tail November Four One Eight Papa"
          ],
          "tags": ["holdover", "nato"]
        },
        {
          "role": "captain",
          "text": "Request holdover expiration warning.",
          "cue": "holdover"
        },
        {
          "role": "iceman",
          "text": "Confirm monitoring and share stop time.",
          "expected": [
            "Monitoring holdover, expect expiration zero five four two zulu, will advise if conditions degrade"
          ],
          "tags": ["monitoring"]
        },
        {
          "role": "captain",
          "text": "Release to taxi and thank crew.",
          "cue": "release"
        },
        {
          "role": "iceman",
          "text": "Close out with clear taxi clearance status and readiness.",
          "expected": [
            "Polar 418, de-ice complete, surfaces clean and slick-free, cleared to taxi to runway 4L"
          ],
          "tags": ["closeout"]
        }
      ]
    }
    $$::jsonb
  ),
  (
    'de-ice-holdover-audit',
    'Holdover recalculation drill',
    'Escalation scenario where holdover time is expiring during a snow burst.',
    $$
    {
      "id": "de-ice-holdover-audit",
      "label": "Holdover recalculation drill",
      "description": "Escalation scenario where holdover time is expiring during a snow burst.",
      "metadata": {
        "holdoverFluid": "Type IV",
        "holdoverStart": "04:48Z",
        "holdoverLimit": "05:18Z"
      },
      "steps": [
        {
          "role": "captain",
          "text": "Iceman, Polar 611 heavy, snow intensifying. Confirm holdover tolerance.",
          "cue": "check"
        },
        {
          "role": "iceman",
          "text": "Quote holdover expiration and request recalculation.",
          "expected": [
            "Polar 611 heavy, current holdover expires zero five one eight zulu, request recalculation for moderate snow"
          ],
          "tags": ["alert"]
        },
        {
          "role": "captain",
          "text": "Authorize additional spray and request inspection interval.",
          "cue": "authorize"
        },
        {
          "role": "iceman",
          "text": "Confirm spray, inspection, and taxi clearance hold.",
          "expected": [
            "Additional Type IV spray authorized, inspection in three minutes, hold position until released"
          ],
          "tags": ["remediation"]
        }
      ]
    }
    $$::jsonb
  )
on conflict (id) do update
  set label = excluded.label,
      description = excluded.description,
      scenario = excluded.scenario;
