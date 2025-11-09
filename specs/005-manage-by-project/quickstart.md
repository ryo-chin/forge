## Quickstart — Manage Sessions by Higher-Level Theme

### Prerequisites
- Node.js 20.x, npm 10+
- Supabase CLI (マイグレーション適用時)
- 事前にログイン済みの Supabase プロジェクト（`time_tracker_sessions` など既存テーブルあり）

### 1. ローカル環境
```bash
npm install
npm run dev
```
- `http://localhost:5173` にアクセスし、新しい「テーマ」UI が表示されることを確認。

### 2. テスト
```bash
npm run test:unit      # reducer / hooks のユニットテスト
npm run test:e2e       # Playwright で分類フローを確認
```
- 新規セッションを開始 → テーマ > プロジェクト選択 → セッション終了 → 履歴で分類が表示される。

### 3. LocalStorage マイグレーション検証
1. 旧バージョンで複数セッションを作成し、`localStorage` の JSON をバックアップ。
2. 新バージョン起動後、補助スクリプトで `project` の文字列から Theme/Project を生成し、デフォルトテーマ「経営者鍛錬」を作成して全セッションを紐づけたうえで `themeId` / `projectId` / `status` / `updatedAt` / `classificationPath` を埋めた JSON を再投入する。
3. 手動移行を行わない場合は `localStorage.removeItem('codex-time-tracker/sessions')` で初期化し、テーマとプロジェクトを再設定する。

### 4. Supabase スキーマ更新
```bash
supabase db push --file supabase/migrations/<timestamp>_add_themes.sql
```
- 追加されるテーブル/カラム:
  - `time_tracker_themes`（owner_id, status, updated_at を含む）
  - `time_tracker_projects.owner_id`, `time_tracker_projects.theme_id`
  - `time_tracker_sessions.theme_id`, `project_id`, `classification_path`
- 既存データはマイグレーション SQL のバックフィル処理でテーマ「経営者鍛錬」を作成し、`theme_id` を一括設定した上で `classification_path` を更新。

### 5. デプロイ前チェック
- `npm run build`
- Playwright で主要フロー（新規分類・既存セッション再分類）を確認。
- Supabase 上で新しいフィールドが反映されていることをコンソールで確認。
- Google Sheets 連携（同期スクリプトまたは手動エクスポート）を実行し、末尾に「Theme」列が追加されていることを確認。

### トラブルシュート
- テーマが表示されない場合: `GET /themes` のレスポンスとキャッシュ（TanStack Query）を確認。
- 既存の project が未分類になる場合: マイグレーションが適用されていないか、既存 project 文字列から Project レコードを生成する処理を確認。
