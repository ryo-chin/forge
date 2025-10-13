-- Google Spreadsheet integration schema

create table if not exists public.google_spreadsheet_connections (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null unique references auth.users(id) on delete cascade,
    google_user_id text not null,
    spreadsheet_id text default null,
    sheet_id integer default null,
    sheet_title text default null,
    access_token text not null,
    refresh_token text not null,
    access_token_expires_at timestamptz not null,
    scopes text[] not null default array['https://www.googleapis.com/auth/spreadsheets'],
    status text not null default 'active' check (status in ('active', 'revoked', 'error')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists google_spreadsheet_connections_user_id_idx
    on public.google_spreadsheet_connections(user_id);

create table if not exists public.google_spreadsheet_column_mappings (
    id uuid primary key default gen_random_uuid(),
    connection_id uuid not null references public.google_spreadsheet_connections(id) on delete cascade,
    mappings jsonb not null,
    required_columns text[] not null default array['title', 'startedAt', 'endedAt', 'durationSeconds'],
    optional_columns text[] not null default array['project', 'notes', 'tags', 'skill', 'intensity'],
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint google_spreadsheet_column_mappings_connection_unique unique (connection_id),
    constraint google_spreadsheet_column_mappings_mappings_is_object check (jsonb_typeof(mappings) = 'object')
);

create table if not exists public.google_sync_logs (
    id uuid primary key default gen_random_uuid(),
    connection_id uuid not null references public.google_spreadsheet_connections(id) on delete cascade,
    session_id uuid not null references public.time_tracker_sessions(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'success', 'failed')),
    attempted_at timestamptz not null default now(),
    failure_reason text default null,
    google_append_request jsonb default null,
    google_append_response jsonb default null,
    retry_count integer not null default 0,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint google_sync_logs_session_unique unique (connection_id, session_id)
);

create index if not exists google_sync_logs_connection_idx
    on public.google_sync_logs(connection_id);

-- Enable RLS
alter table if exists public.google_spreadsheet_connections enable row level security;
alter table if exists public.google_spreadsheet_column_mappings enable row level security;
alter table if exists public.google_sync_logs enable row level security;

-- Connections policies
do $$
begin
    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_spreadsheet_connections'
           and policyname = 'google_spreadsheet_connections_select_own'
    ) then
        create policy google_spreadsheet_connections_select_own
            on public.google_spreadsheet_connections
            for select
            using (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_spreadsheet_connections'
           and policyname = 'google_spreadsheet_connections_insert_own'
    ) then
        create policy google_spreadsheet_connections_insert_own
            on public.google_spreadsheet_connections
            for insert
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_spreadsheet_connections'
           and policyname = 'google_spreadsheet_connections_update_own'
    ) then
        create policy google_spreadsheet_connections_update_own
            on public.google_spreadsheet_connections
            for update
            using (auth.uid() = user_id)
            with check (auth.uid() = user_id);
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_spreadsheet_connections'
           and policyname = 'google_spreadsheet_connections_delete_own'
    ) then
        create policy google_spreadsheet_connections_delete_own
            on public.google_spreadsheet_connections
            for delete
            using (auth.uid() = user_id);
    end if;
end;
$$;

-- Column mappings policies
do $$
begin
    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_spreadsheet_column_mappings'
           and policyname = 'google_spreadsheet_column_mappings_select_own'
    ) then
        create policy google_spreadsheet_column_mappings_select_own
            on public.google_spreadsheet_column_mappings
            for select
            using (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            );
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_spreadsheet_column_mappings'
           and policyname = 'google_spreadsheet_column_mappings_insert_own'
    ) then
        create policy google_spreadsheet_column_mappings_insert_own
            on public.google_spreadsheet_column_mappings
            for insert
            with check (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            );
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_spreadsheet_column_mappings'
           and policyname = 'google_spreadsheet_column_mappings_update_own'
    ) then
        create policy google_spreadsheet_column_mappings_update_own
            on public.google_spreadsheet_column_mappings
            for update
            using (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            )
            with check (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            );
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_spreadsheet_column_mappings'
           and policyname = 'google_spreadsheet_column_mappings_delete_own'
    ) then
        create policy google_spreadsheet_column_mappings_delete_own
            on public.google_spreadsheet_column_mappings
            for delete
            using (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            );
    end if;
end;
$$;

-- Sync logs policies
do $$
begin
    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_sync_logs'
           and policyname = 'google_sync_logs_select_own'
    ) then
        create policy google_sync_logs_select_own
            on public.google_sync_logs
            for select
            using (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            );
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_sync_logs'
           and policyname = 'google_sync_logs_insert_own'
    ) then
        create policy google_sync_logs_insert_own
            on public.google_sync_logs
            for insert
            with check (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            );
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_sync_logs'
           and policyname = 'google_sync_logs_update_own'
    ) then
        create policy google_sync_logs_update_own
            on public.google_sync_logs
            for update
            using (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            )
            with check (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            );
    end if;

    if not exists (
        select 1 from pg_policies
         where schemaname = 'public'
           and tablename = 'google_sync_logs'
           and policyname = 'google_sync_logs_delete_own'
    ) then
        create policy google_sync_logs_delete_own
            on public.google_sync_logs
            for delete
            using (
                exists (
                    select 1
                      from public.google_spreadsheet_connections c
                     where c.id = connection_id
                       and c.user_id = auth.uid()
                )
            );
    end if;
end;
$$;
