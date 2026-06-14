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

-- MCP bearer tokens for remote HTTP MCP clients.
create table if not exists public.forge_mcp_tokens (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    token_hash text not null unique,
    scopes text[] not null default array['time-tracker:read', 'time-tracker:write'],
    expires_at timestamptz not null,
    revoked_at timestamptz default null,
    last_used_at timestamptz default null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint forge_mcp_tokens_name_not_blank check (length(btrim(name)) > 0),
    constraint forge_mcp_tokens_scopes_not_empty check (array_length(scopes, 1) > 0),
    constraint forge_mcp_tokens_scopes_allowed
        check (scopes <@ array['time-tracker:read', 'time-tracker:write'])
);

create index if not exists forge_mcp_tokens_user_id_idx
    on public.forge_mcp_tokens(user_id);

create index if not exists forge_mcp_tokens_token_hash_idx
    on public.forge_mcp_tokens(token_hash);

-- RLS 設定
alter table if exists public.time_tracker_sessions enable row level security;
alter table if exists public.time_tracker_running_states enable row level security;
alter table if exists public.forge_mcp_tokens enable row level security;

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

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'forge_mcp_tokens'
          and policyname = 'forge_mcp_tokens_select_own'
    ) then
        create policy forge_mcp_tokens_select_own
            on public.forge_mcp_tokens
            for select
            using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'forge_mcp_tokens'
          and policyname = 'forge_mcp_tokens_insert_own'
    ) then
        create policy forge_mcp_tokens_insert_own
            on public.forge_mcp_tokens
            for insert
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'forge_mcp_tokens'
          and policyname = 'forge_mcp_tokens_update_own'
    ) then
        create policy forge_mcp_tokens_update_own
            on public.forge_mcp_tokens
            for update
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'forge_mcp_tokens'
          and policyname = 'forge_mcp_tokens_delete_own'
    ) then
        create policy forge_mcp_tokens_delete_own
            on public.forge_mcp_tokens
            for delete
            using (auth.uid() = user_id);
    end if;
end;
$$;

-- =====================================================================
-- 予実管理（タグ単位・曜日別スケジュール）
-- =====================================================================
-- 対象タグごとに「曜日別の1日あたり予算（分）」と有効期間を持つ。
-- 実績はアプリ側で time_tracker_sessions を日次集計して導出する。
create table if not exists public.time_tracker_budgets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    tag text not null,
    label text default null,
    -- 長さ7。index 0 = 日曜（JS Date.getDay() 準拠）の1日あたり予算「分」
    weekday_minutes integer[] not null default array[0, 0, 0, 0, 0, 0, 0],
    effective_from date not null,
    effective_to date default null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint time_tracker_budgets_tag_not_blank check (length(btrim(tag)) > 0),
    constraint time_tracker_budgets_weekday_minutes_len
        check (array_length(weekday_minutes, 1) = 7),
    constraint time_tracker_budgets_effective_range
        check (effective_to is null or effective_to >= effective_from)
);

create index if not exists time_tracker_budgets_user_id_idx
    on public.time_tracker_budgets(user_id);

-- =====================================================================
-- デイリーカスタム記録（真偽 / 数値を実装。選択式は value=jsonb で土台のみ）
-- =====================================================================
create table if not exists public.daily_metric_definitions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    kind text not null check (kind in ('boolean', 'number', 'text', 'single_select', 'multi_select')),
    unit text default null,
    options jsonb default null,        -- 選択式の [{value,label}]（将来用）
    target_number numeric default null, -- 数値項目の目標値（将来の予実化フック）
    display_order integer not null default 0,
    archived_at timestamptz default null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint daily_metric_definitions_name_not_blank check (length(btrim(name)) > 0)
);

create index if not exists daily_metric_definitions_user_id_idx
    on public.daily_metric_definitions(user_id);

create table if not exists public.daily_metric_entries (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    metric_id uuid not null references public.daily_metric_definitions(id) on delete cascade,
    entry_date date not null,
    -- boolean: true/false / number: 数値 / single_select: "v" / multi_select: ["a","b"]
    value jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint daily_metric_entries_unique_per_day unique (user_id, metric_id, entry_date)
);

create index if not exists daily_metric_entries_user_id_idx
    on public.daily_metric_entries(user_id);
create index if not exists daily_metric_entries_metric_date_idx
    on public.daily_metric_entries(metric_id, entry_date);

-- RLS 設定（予実・デイリー記録）
alter table if exists public.time_tracker_budgets enable row level security;
alter table if exists public.daily_metric_definitions enable row level security;
alter table if exists public.daily_metric_entries enable row level security;

do $$
declare
    tbl text;
    op text;
    policy_name text;
    using_clause text;
    check_clause text;
begin
    foreach tbl in array array[
        'time_tracker_budgets',
        'daily_metric_definitions',
        'daily_metric_entries'
    ]
    loop
        foreach op in array array['select', 'insert', 'update', 'delete']
        loop
            policy_name := format('%s_%s_own', tbl, op);
            if not exists (
                select 1 from pg_policies
                where schemaname = 'public'
                  and tablename = tbl
                  and policyname = policy_name
            ) then
                if op = 'insert' then
                    execute format(
                        'create policy %I on public.%I for insert with check (auth.uid() = user_id)',
                        policy_name, tbl
                    );
                elsif op = 'update' then
                    execute format(
                        'create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)',
                        policy_name, tbl
                    );
                else
                    execute format(
                        'create policy %I on public.%I for %s using (auth.uid() = user_id)',
                        policy_name, tbl, op
                    );
                end if;
            end if;
        end loop;
    end loop;
end;
$$;
