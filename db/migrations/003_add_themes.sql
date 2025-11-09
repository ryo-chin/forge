-- Migration: Add themes table and classification columns

create table if not exists time_tracker_themes (
    id uuid primary key,
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    status text not null default 'active' check (status in ('active','archived')),
    color text default null,
    description text default null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists time_tracker_themes_owner_id_idx
    on time_tracker_themes(owner_id);

alter table if exists public.time_tracker_themes enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_themes'
          and policyname = 'time_tracker_themes_select_own'
    ) then
        create policy time_tracker_themes_select_own
            on public.time_tracker_themes
            for select
            using (auth.uid() = owner_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_themes'
          and policyname = 'time_tracker_themes_insert_own'
    ) then
        create policy time_tracker_themes_insert_own
            on public.time_tracker_themes
            for insert
            with check (auth.uid() = owner_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_themes'
          and policyname = 'time_tracker_themes_update_own'
    ) then
        create policy time_tracker_themes_update_own
            on public.time_tracker_themes
            for update
            using (auth.uid() = owner_id)
            with check (auth.uid() = owner_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_themes'
          and policyname = 'time_tracker_themes_delete_own'
    ) then
        create policy time_tracker_themes_delete_own
            on public.time_tracker_themes
            for delete
            using (auth.uid() = owner_id);
    end if;
end;
$$;

alter table if exists time_tracker_sessions
    add column if not exists theme_id uuid references time_tracker_themes(id),
    add column if not exists project_id uuid,
    add column if not exists classification_path text[];
