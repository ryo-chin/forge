-- Forge remote HTTP MCP bearer token metadata.
-- Token raw values are returned only once by the Worker and only token_hash is stored.

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

alter table if exists public.forge_mcp_tokens enable row level security;

do $$
begin
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
