# Time Tracker Worker API / MCP Verification Plan

## Scope

ブラウザと MCP の両方が最終的に同じ Cloudflare Worker API を使えるようにする。今回の実装はローカル差分だけで進め、Cloudflare / Supabase / Google / GitHub への deploy、apply、migration、token 発行、push は行わない。

## Task slices

1. Verification foundation
   - Worker handler tests を先に追加し、Supabase / Google / Cloudflare への実通信を `vi.fn` で遮断する。
   - Repository tests で Supabase REST の URL と body を検査し、`user_id` は認証済み user id からのみ入ることを確認する。
   - Static guard tests で service role key が app 側へ露出しないこと、time-tracker handler が request body の `user_id` / `userId` を参照しないことを確認する。
2. Canonical Worker API
   - `GET /time-tracker/running`
   - `POST /time-tracker/running/start`
   - `PATCH /time-tracker/running/update`
   - `POST /time-tracker/running/stop`
   - `POST /time-tracker/running/cancel`
   - すべて Supabase JWT で認証し、Worker は verified user id だけを使って Supabase REST を呼ぶ。
3. Browser migration
   - 既存 app の direct Supabase write を Worker API に移すかは別 slice で判断する。
   - 移行する場合も dual-write divergence を避け、Supabase canonical state と Sheets sync の順序をテストする。
4. MCP auth
   - local MCP は Forge scoped token を候補にする。Supabase refresh token、service role key、Google refresh token は MCP に渡さない。
   - remote MCP は OAuth-compatible flow を別 slice で検討する。
5. Cloudflare IaC
   - Pulumi / Terraform の候補はローカル設計または scaffold まで。`pulumi up` / `terraform apply` / `wrangler deploy` は明日の同席確認まで禁止。

## Local verification commands

- `pnpm --filter api test:run`
- `pnpm --filter api lint`
- `pnpm format:check`
- Workspace 側の governance 変更後は `bun run ai:verify`

## Deferred paired checks

- Cloudflare Worker vars / secrets / routes / CORS origin
- Supabase service role secret rotation and RLS bypass boundary
- Google OAuth redirect URI and token storage policy
- GitHub branch / PR publication
