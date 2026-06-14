-- 予実管理（プロジェクト/タグ単位・曜日別予算）とデイリーカスタム記録。
-- 実績はアプリ側で time_tracker_sessions を集計して導出する。
-- 冪等（create if not exists + ポリシー存在チェック）なので再適用しても安全。

-- =====================================================================
-- 予実（プロジェクト/タグ単位・曜日別スケジュール）
-- =====================================================================
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
-- デイリーカスタム記録（チェック/数値/テキスト/選択。選択式は value=jsonb で吸収）
-- =====================================================================
create table if not exists public.daily_metric_definitions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    kind text not null check (kind in ('boolean', 'number', 'text', 'single_select', 'multi_select')),
    unit text default null,
    options jsonb default null,
    target_number numeric default null,
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
    value jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint daily_metric_entries_unique_per_day unique (user_id, metric_id, entry_date)
);

create index if not exists daily_metric_entries_user_id_idx
    on public.daily_metric_entries(user_id);
create index if not exists daily_metric_entries_metric_date_idx
    on public.daily_metric_entries(metric_id, entry_date);

-- RLS（own-rows のみ）
alter table if exists public.time_tracker_budgets enable row level security;
alter table if exists public.daily_metric_definitions enable row level security;
alter table if exists public.daily_metric_entries enable row level security;

do $$
declare
    tbl text;
    op text;
    policy_name text;
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
                where schemaname = 'public' and tablename = tbl and policyname = policy_name
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
