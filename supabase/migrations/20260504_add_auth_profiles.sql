create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_id text not null unique,
  faculty text,
  school_year integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_id_format
    check (display_id ~ '^[a-z0-9_]{3,24}$'),
  constraint profiles_school_year_range
    check (school_year is null or school_year between 1 and 6)
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_display_id text;
  raw_school_year text;
begin
  normalized_display_id := lower(
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_id', ''),
      split_part(new.email, '@', 1)
    )
  );
  raw_school_year := nullif(new.raw_user_meta_data ->> 'school_year', '');

  insert into public.profiles (
    id,
    display_id,
    faculty,
    school_year
  )
  values (
    new.id,
    normalized_display_id,
    nullif(new.raw_user_meta_data ->> 'faculty', ''),
    case
      when raw_school_year ~ '^[0-9]+$' then raw_school_year::integer
      else null
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();
