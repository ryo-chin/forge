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
