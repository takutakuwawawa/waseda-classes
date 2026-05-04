create table if not exists public.saved_classes (
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, class_id)
);

alter table public.saved_classes enable row level security;

drop policy if exists "saved_classes_select_own" on public.saved_classes;
create policy "saved_classes_select_own"
on public.saved_classes
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "saved_classes_insert_own" on public.saved_classes;
create policy "saved_classes_insert_own"
on public.saved_classes
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "saved_classes_delete_own" on public.saved_classes;
create policy "saved_classes_delete_own"
on public.saved_classes
for delete
to authenticated
using (auth.uid() = user_id);

create extension if not exists pgcrypto;

create table if not exists public.timetable_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  class_id text not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, class_id)
);

alter table public.timetable_items enable row level security;

drop policy if exists "timetable_items_select_own" on public.timetable_items;
create policy "timetable_items_select_own"
on public.timetable_items
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "timetable_items_insert_own" on public.timetable_items;
create policy "timetable_items_insert_own"
on public.timetable_items
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "timetable_items_update_own" on public.timetable_items;
create policy "timetable_items_update_own"
on public.timetable_items
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "timetable_items_delete_own" on public.timetable_items;
create policy "timetable_items_delete_own"
on public.timetable_items
for delete
to authenticated
using (auth.uid() = user_id);

drop trigger if exists set_timetable_items_updated_at on public.timetable_items;
create trigger set_timetable_items_updated_at
before update on public.timetable_items
for each row
execute function public.set_updated_at();
