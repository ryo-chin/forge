# Quickstart — Google Spreadsheet Integration

## 1. 前提条件

- Node.js 20.x（`npm run build` が既存フロントエンド要件）
- Supabase プロジェクトおよび Service Role Key
- Google Cloud Console で OAuth クライアント ID（Web アプリ）を作成済み
- Cloudflare Workers CLI (`wrangler`) インストール済み

## 2. 環境変数

| 変数名 | 用途 | 設定対象 |
| --- | --- | --- |
| `VITE_TIME_DATA_SOURCE` | `supabase` を指定すると Supabase 経由でセッションを永続化 | `app/.env` |
| `SUPABASE_URL` | Supabase プロジェクト URL | Worker Secret |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | Worker Secret |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | Worker Secret / Frontend env |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアントシークレット | Worker Secret |
| `GOOGLE_REDIRECT_URI` | 例: `https://api.example.com/integrations/google/oauth/callback` | Google Console / Worker Env |

Worker のシークレットは `wrangler secret put <NAME>` で登録する。

## 3. セットアップ手順

1. 依存関係をインストール: `npm install`
2. `app/.env` を `.env.example` からコピーし、Supabase 接続値を設定
3. Google Cloud Console で OAuth クライアントを作成し、リダイレクト URI に Worker のコールバック URL を追加
4. Cloudflare Workers にシークレットを設定:
   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   wrangler secret put GOOGLE_REDIRECT_URI
   ```
5. Supabase 側に以下のテーブルを準備（`sql` ディレクトリにマイグレーションを追加予定）:
   - `google_spreadsheet_connections`
   - `google_spreadsheet_column_mappings`
   - `google_sync_logs`

## 4. ローカル開発

- フロントエンド: `npm run dev`
- Workers（予定）: `npm run dev:worker` → `wrangler dev workers/google-sync.ts`
- フロントエンド開発時は `VITE_API_BASE_URL=http://localhost:8787` を設定して Worker のローカルサーバーにプロキシする
- `npm run test:unit` でドメインロジックのテスト、`npm run test:e2e` で同期フローの E2E テストを追加予定

## 5. Google OAuth 設定確認

1. `POST /integrations/google/oauth/start` を叩き、返却された `authorizationUrl` にブラウザでアクセス
2. Google で認証後、Worker が Supabase にトークンを保存しフロントエンドへリダイレクトすることを確認
3. `GET /integrations/google/settings` で `connectionStatus=active` が返るかを確認

## 6. 同期テスト

1. Time Tracker で計測を開始・停止して Supabase `time_tracker_sessions` に行が追加されることを確認
2. 停止時に Worker `POST /integrations/google/sync` が呼ばれ、Google スプレッドシートに行が append されることを確認
3. スプレッドシート連携を意図的に失敗させ、UI がエラーを通知し `SyncLog` に記録されることを確認
4. `POST /integrations/google/sync/{sessionId}/retry` で再同期が成功することを確認

## 7. デプロイの流れ（案）

1. `npm run build`
2. `wrangler deploy workers/google-sync.ts --name ${SANITIZED_BRANCH}`
3. Cloudflare Pages / Workers KV に必要な設定を同期
4. Supabase マイグレーションを適用後、CI で E2E テストを実行

> 今後の実装で、マイグレーションスクリプトと Worker 用 `package.json` を整備する。
