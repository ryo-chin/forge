# Quickstart — Google Spreadsheet Integration

Time TrackerのセッションをGoogle Spreadsheetsへ自動同期する機能のセットアップガイドです。

## 1. 前提条件

- **Node.js**: 20.x 以上
- **Supabase プロジェクト**: [https://supabase.com/](https://supabase.com/) でプロジェクト作成済み
- **Google Cloud Console**: OAuth 2.0 クライアント ID を作成済み
- **Cloudflare Workers CLI**: `npm install -g wrangler` でインストール済み

## 2. データベース設定（Supabase）

### 2.1. マイグレーションの適用

Supabase ダッシュボード → SQL Editor で以下のマイグレーションを実行します：

```bash
# マイグレーションファイルの内容を実行
# db/migrations/001_google_spreadsheet_integration.sql
```

これにより以下のテーブルが作成されます：
- `google_spreadsheet_connections` - Google アカウント連携情報
- `google_spreadsheet_column_mappings` - カラムマッピング設定
- `google_sync_logs` - 同期履歴ログ

### 2.2. Supabase の認証情報を取得

Supabase ダッシュボード → Settings → API で以下を取得：
- **Project URL**: `https://xxx.supabase.co`
- **anon public key**: `eyJ...`（フロントエンド用）
- **service_role key**: `eyJ...`（Worker用、**秘密情報**）

## 3. Google OAuth 設定

### 3.1. Google Cloud Console でプロジェクト作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成（または既存のプロジェクトを選択）
3. 「APIとサービス」→「認証情報」に移動

### 3.2. OAuth 2.0 クライアント ID の作成

1. 「認証情報を作成」→「OAuth クライアント ID」を選択
2. アプリケーションの種類: **ウェブ アプリケーション**
3. 名前: `Time Tracker - Google Sheets Integration`（任意）
4. **承認済みのリダイレクト URI** に追加:
   - ローカル開発用: `http://localhost:8787/integrations/google/oauth/callback`
   - 本番環境用: `https://your-worker.workers.dev/integrations/google/oauth/callback`
5. 作成後、**クライアント ID** と **クライアント シークレット** をメモ

### 3.3. Google Sheets API の有効化

1. 「APIとサービス」→「ライブラリ」に移動
2. 「Google Sheets API」を検索して有効化
3. 「Google Drive API」も検索して有効化（スプレッドシート一覧取得に必要）

## 4. ローカル開発環境のセットアップ

### 4.1. フロントエンド（app）の設定

```bash
cd app
cp .env.example .env
```

`app/.env` を編集：

```bash
# データソースをSupabaseに設定
VITE_TIME_DATA_SOURCE=supabase

# Supabase設定
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your-anon-key...

# Google連携を有効化（WorkerのURLを設定）
VITE_GOOGLE_SYNC_API_BASE_URL=http://localhost:8787
```

### 4.2. Worker（workers/google-sync）の設定

```bash
cd workers/google-sync
npm install
cp .dev.vars.example .dev.vars
```

`workers/google-sync/.dev.vars` を編集：

```bash
# Supabase設定
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# Google OAuth設定
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx...
GOOGLE_REDIRECT_URI=http://localhost:8787/integrations/google/oauth/callback
```

**⚠️ 重要**: `.dev.vars` ファイルは Git にコミットしないでください（`.gitignore` に追加済み）

## 5. 環境変数一覧

### フロントエンド（app/.env）

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `VITE_TIME_DATA_SOURCE` | データソース（`local` または `supabase`） | `supabase` |
| `VITE_SUPABASE_URL` | Supabase プロジェクト URL | `https://xxx.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key（公開OK） | `eyJ...` |
| `VITE_GOOGLE_SYNC_API_BASE_URL` | Worker の URL（空にすると無効） | `http://localhost:8787` |

### Worker（workers/google-sync/.dev.vars）

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `SUPABASE_URL` | Supabase プロジェクト URL | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key（**秘密**） | `eyJ...` |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアント シークレット（**秘密**） | `GOCSPX-xxx` |
| `GOOGLE_REDIRECT_URI` | OAuth リダイレクト URI | `http://localhost:8787/integrations/google/oauth/callback` |

## 6. ローカル開発の開始

### ターミナル1: Worker の起動

```bash
cd workers/google-sync
npm run dev
```

Worker が `http://localhost:8787` で起動します。

### ターミナル2: フロントエンドの起動

```bash
cd app
npm run dev
```

フロントエンドが `http://localhost:5173` で起動します。

## 7. 動作確認手順

### 7.1. Time Tracker の基本動作確認

1. ブラウザで `http://localhost:5173` にアクセス
2. Supabaseの認証画面でログイン（または新規登録）
3. Time Tracker でタイトルを入力して「開始」ボタンをクリック
4. しばらく待って「停止」ボタンをクリック
5. セッションが履歴に表示されることを確認

### 7.2. Google連携の設定

1. Time Tracker ページの右上にある「⚙️ 設定」ボタンをクリック
2. 「Google アカウントと連携」ボタンをクリック
3. Google の認証画面が開くので、アカウントを選択して認証
4. 認証後、Time Tracker ページにリダイレクトされる
5. 再度「⚙️ 設定」ボタンをクリック

### 7.3. スプレッドシート・シートの選択

1. 設定ダイアログで「スプレッドシート」ドロップダウンから対象のスプレッドシートを選択
2. 「シート」ドロップダウンから対象のシートを選択
3. （オプション）カラムマッピングセクションで各フィールドの列を指定
   - 例: タイトル → `A`, 開始時刻 → `B`, 終了時刻 → `C`, 所要時間 → `D`
4. 「保存」ボタンをクリック

### 7.4. 自動同期のテスト

1. Time Tracker で新しいセッションを開始
2. セッションを停止
3. Google Spreadsheetsを開いて、選択したシートに新しい行が追加されていることを確認
4. 設定したカラムマッピングに従ってデータが配置されていることを確認

### 7.5. エラーハンドリングのテスト

同期エラーをテストするには：
1. Worker を一時停止（Ctrl+C）
2. Time Tracker でセッションを停止
3. エラー通知が表示されることを確認
4. Worker を再起動
5. エラー通知の「リトライ」ボタンをクリック
6. 同期が成功することを確認

## 8. トラブルシューティング

### Worker が起動しない

- `.dev.vars` ファイルが正しく設定されているか確認
- `workers/google-sync/node_modules` を削除して `npm install` を再実行

### Google認証後にリダイレクトされない

- Google Cloud Console で設定したリダイレクトURIが正しいか確認
- ローカル開発の場合: `http://localhost:8787/integrations/google/oauth/callback`

### スプレッドシートが表示されない

- Google Drive API が有効になっているか確認
- Google Sheets API が有効になっているか確認
- OAuth スコープに `https://www.googleapis.com/auth/drive.readonly` が含まれているか確認

### 同期が失敗する

- Worker のログを確認: ターミナルに表示されるエラーメッセージを確認
- Supabase のログを確認: Supabase ダッシュボード → Logs
- Google Sheets API のクォータを確認: Google Cloud Console → APIs & Services → Dashboard

## 9. 本番環境へのデプロイ（参考）

### 9.1. Worker のデプロイ

```bash
cd workers/google-sync
wrangler deploy
```

### 9.2. 本番環境用のシークレット設定

```bash
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REDIRECT_URI
```

### 9.3. フロントエンドの環境変数更新

本番環境の `app/.env` で Worker の本番URLを設定：

```bash
VITE_GOOGLE_SYNC_API_BASE_URL=https://your-worker.workers.dev
```

### 9.4. Google OAuth の本番リダイレクトURI追加

Google Cloud Console で本番環境のリダイレクトURIを追加：
- `https://your-worker.workers.dev/integrations/google/oauth/callback`

## 10. 参考リンク

- [Supabase Documentation](https://supabase.com/docs)
- [Google Sheets API](https://developers.google.com/sheets/api)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
