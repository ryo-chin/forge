# Frontend

`app/` はアプリケーション全体のルートです。

## Features
- TimeTracker: `features/time-tracker/`

## 実装ガイドライン

`app/IMPLEMENTS.md` 参照

## セットアップ

```bash
pnpm install
```

## 利用可能なスクリプト

- `pnpm dev` — Vite 開発サーバーを起動
- `pnpm test` — Vitest でユニットテストを実行
- `pnpm test:e2e` — Playwright でE2Eテストを実行
- `pnpm build` — 型チェックと本番ビルドを実行

**Lint**: プロジェクトルートから `pnpm format:check`（Biome）または `pnpm lint`（ESLint）を実行してください。

## 環境変数

`.env` ファイルを `app/.env.example` から作成し、必要な値をセットしてください。

| 変数名 | 用途 |
| --- | --- |
| `VITE_TIME_DATA_SOURCE` | データソースの選択 (`local` / `supabase`) |
| `VITE_SUPABASE_URL` | Supabase プロジェクトの URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase Anon Key（認証済みユーザーで利用） |

`local` の場合は従来どおりブラウザの LocalStorage を利用します。`supabase` を指定すると Supabase への永続化コードが動作します。

## 参考ドキュメント

- CSS ガイドライン: `docs/adr/app-by-codex/20250925-css-guidelines.md`
