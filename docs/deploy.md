## デプロイの仕組み

このアプリケーションはCloudflare Workers/Pagesを使用してデプロイされます。

- **自動デプロイ**: `main`ブランチへのpush時に自動的にデプロイされます
- **手動デプロイ**: ローカルから `npm run deploy` コマンドで手動デプロイも可能です
- **ビルド設定**: `app/wrangler.json`で設定されています

## 環境変数の設定

環境ごとに異なる環境変数ファイルを使用します:

### 開発環境（ローカル）
- ファイル: `app/.env.development`
- 開発用Supabaseプロジェクトの設定を記述

### 本番環境
- ファイル: `app/.env.production`
- 本番用Supabaseプロジェクトの設定を記述
- Cloudflare Pagesの環境変数設定でも以下を設定:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`

### 必要な環境変数
```
VITE_TIME_DATA_SOURCE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## デプロイ手順

### 初回セットアップ

1. Supabaseプロジェクトを2つ作成（開発用・本番用）
2. 各プロジェクトでデータベーススキーマを適用（`db/tables.sql`）
3. Google OAuth設定を完了
4. 環境変数ファイルを作成
   ```bash
   cp app/.env.example app/.env.development
   cp app/.env.example app/.env.production
   ```
5. 各環境変数ファイルに適切な値を設定

### 自動デプロイ

`main`ブランチにpushするだけで自動的にデプロイされます。

### 手動デプロイ

```bash
cd app
npm run deploy
```
