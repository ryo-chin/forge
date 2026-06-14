# Remote HTTP MCP

Forge Worker exposes a stateless remote MCP endpoint for Time Tracker operations.

## Secrets

Set this Worker secret before deploying code that uses `/mcp` or `/mcp/tokens`:

- `MCP_TOKEN_HASH_PEPPER`: HMAC pepper for hashing `forge_mcp_...` bearer tokens before Supabase storage.

The raw MCP token is never stored. `forge_mcp_tokens.token_hash` stores only the peppered HMAC-SHA-256 digest.

## Database

Apply `db/migrations/003_forge_mcp_tokens.sql`.

The table stores token metadata:

- `user_id`
- `name`
- `token_hash`
- `scopes`
- `expires_at`
- `revoked_at`
- `last_used_at`

RLS policies restrict direct Supabase access to the owning user. The Worker still uses the service role key and must enforce user ownership in repository filters.

## Token API

Token management uses the normal Forge/Supabase access token:

```bash
curl -X POST "$FORGE_API_BASE/mcp/tokens" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Codex","scopes":["time-tracker:read","time-tracker:write"],"expiresInDays":90}'
```

The response includes the raw `token` only once. Store it in the MCP client secret store, not in Git.

Other endpoints:

- `GET /mcp/tokens`
- `DELETE /mcp/tokens/:id`

## MCP Endpoint

MCP clients call:

```text
POST /mcp
Authorization: Bearer forge_mcp_...
Content-Type: application/json
```

Supported tools:

- `ForgeTimeTrackerStart`
- `ForgeTimeTrackerStatus`
- `ForgeTimeTrackerStop`
- `ForgeTimeTrackerCancel`

`ForgeTimeTrackerStop` records the session in Supabase and then attempts the existing Google Sheets sync. If Google reconnect is required, the session remains recorded and the `sync` field reports the failure/skipped reason.
