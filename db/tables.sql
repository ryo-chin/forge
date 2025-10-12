-- セッション一覧
create table if not exists time_tracker_sessions (
    id uuid primary key,
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    started_at timestamptz not null,
    ended_at timestamptz not null,
    duration_seconds integer not null,
    tags text[] default null,
    project text default null,
    notes text default null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
    );

create index if not exists time_tracker_sessions_user_id_idx
    on time_tracker_sessions(user_id);

-- 走行中セッション状態（ユーザーごとに1行）
create table if not exists time_tracker_running_states (
    user_id uuid primary key references auth.users(id) on delete cascade,
    status text not null check (status in ('idle', 'running')),
    elapsed_seconds integer not null default 0,
    draft jsonb default null,
    updated_at timestamptz not null default now()
    );

-- RLS 設定
alter table if exists public.time_tracker_sessions enable row level security;
alter table if exists public.time_tracker_running_states enable row level security;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_sessions'
          and policyname = 'time_tracker_sessions_select_own'
    ) then
        create policy time_tracker_sessions_select_own
            on public.time_tracker_sessions
            for select
            using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_sessions'
          and policyname = 'time_tracker_sessions_insert_own'
    ) then
        create policy time_tracker_sessions_insert_own
            on public.time_tracker_sessions
            for insert
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_sessions'
          and policyname = 'time_tracker_sessions_update_own'
    ) then
        create policy time_tracker_sessions_update_own
            on public.time_tracker_sessions
            for update
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_sessions'
          and policyname = 'time_tracker_sessions_delete_own'
    ) then
        create policy time_tracker_sessions_delete_own
            on public.time_tracker_sessions
            for delete
            using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_running_states'
          and policyname = 'time_tracker_running_states_select_own'
    ) then
        create policy time_tracker_running_states_select_own
            on public.time_tracker_running_states
            for select
            using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_running_states'
          and policyname = 'time_tracker_running_states_insert_own'
    ) then
        create policy time_tracker_running_states_insert_own
            on public.time_tracker_running_states
            for insert
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_running_states'
          and policyname = 'time_tracker_running_states_update_own'
    ) then
        create policy time_tracker_running_states_update_own
            on public.time_tracker_running_states
            for update
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'time_tracker_running_states'
          and policyname = 'time_tracker_running_states_delete_own'
    ) then
        create policy time_tracker_running_states_delete_own
            on public.time_tracker_running_states
            for delete
            using (auth.uid() = user_id);
    end if;
end;
$$;
