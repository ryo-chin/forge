## Data Model — Manage Sessions by Higher-Level Theme

### Entities

#### Theme
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | `string` (UUID) | primary key | Generated client-side（`crypto.randomUUID()`） |
| ownerId | `string` | required | References owning user (future: group/org id) |
| name | `string` | required, unique per owner, max 50 chars | Display label on UI |
| description | `string` | optional | Tool-tip or future detail view |
| color | `string` | optional (`#RRGGBB`) | Visual indicator |
| createdAt | `number` (epoch ms) | required | Persisted for sorting |
| updatedAt | `number` (epoch ms) | required | Last mutation timestamp |
| status | `'active' \| 'archived'` | required | Logical archive flag (default `active`) |

#### Project
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | `string` (UUID) | primary key | Generated client-side（`crypto.randomUUID()`） |
| ownerId | `string` | required | Mirrors owning entity id |
| name | `string` | required | Shown to user |
| themeId | `string` (UUID) \| `null` | FK → Theme.id | Null = 未分類 |
| createdAt | `number` (epoch ms) | required | |
| updatedAt | `number` (epoch ms) | required | |
| status | `'active' \| 'archived'` | required | Logical archive flag (default `active`) |

#### TimeTrackerSession (extended)
| Field | Type | Notes |
|-------|------|-------|
| id | `string` | existing |
| title | `string` | existing |
| startedAt | `number` | existing |
| endedAt | `number` | existing |
| durationSeconds | `number` | existing |
| tags | `string[]` \| `undefined` | existing |
| skill | `string` \| `undefined` | existing |
| project | `string` \| `undefined` | existing text field (互換性維持のため保持) |
| projectId | `string` \| `null` | NEW, references Project.id |
| themeId | `string` \| `null` | NEW, references Theme.id |
| classificationPath | `string[]` | NEW, hierarchical path（例: `['themeId', 'projectId']`） |
| intensity | `'low' \| 'medium' \| 'high'` \| `undefined` | existing |
| notes | `string` \| `undefined` | existing |

#### SessionDraft (extended)
同上構造で `projectId`, `themeId`, `classificationPath` を追加。

### Relationships
- Owner (current user) (1) — (N) Theme
- Owner (current user) (1) — (N) Project
- Theme (1) — (N) Project （同一 `ownerId` 間でのみ関連付け可能）
- Theme (1) — (N) TimeTrackerSession（through themeId）
- Project (1) — (N) TimeTrackerSession（through projectId）
- classificationPath は階層順の ID 配列で、将来 `['themeId', 'subcategoryId', 'projectId']` のように拡張できる。

### Derived/Computed Data
- `ThemeSummary`: `{ themeId, totalDuration, sessionCount }`
- `ProjectSummary`: `{ projectId, totalDuration, sessionCount }`
- UI でのツリー表示は `Theme` と `Project` を結合し classificationPath を使って生成。
- Google Sheets Export Row: `['Session ID', 'Title', ..., 'Theme', 'Project', ...]`（Theme 列は既存列の後ろに追加）

### Persistence & Migration

#### LocalStorage
- 保存形式は従来の `codex-time-tracker/sessions` キーを継続利用し、配列構造に `themeId` / `projectId` / `classificationPath` / `status` / `updatedAt` を追加する。
- マイグレーションは手動で実施する前提とし、リリースノートまたは README に以下の手順を提示する:
  1. リリース前に既存データをエクスポート（例: DevTools で JSON をコピー）。
  2. 新バージョン起動後、スクリプトやユーティリティで従来の `project` 文字列をもとに Theme/Project を生成し、デフォルトテーマ「経営者鍛錬」を作成して既存セッションをすべて紐づけ、`status`/`updatedAt` を設定した JSON を再投入。
  3. もしくは一度 LocalStorage をクリアし、テーマを再設定する（ユーザーが自身一人のため許容範囲）。
- コード側では旧フィールドを検出した場合に都度補完する処理を入れ、バージョン番号による分岐は行わない。

#### Supabase
- `time_tracker_themes` テーブル新設（`owner_id uuid not null`, `status text check (status in ('active','archived')) default 'active'`, `updated_at timestamptz default now()` を含む）。`unique (owner_id, name)` を付与し、同一所有者内で重複作成を防ぐ。
- マイグレーション時にデフォルトテーマ「経営者鍛錬」を seed し、既存プロジェクト/セッションの `theme_id` をその ID に設定（`owner_id` は各行に既存のユーザー ID を引き継ぐ）。
- `time_tracker_projects` テーブルに `theme_id uuid references time_tracker_themes(id)` と `owner_id uuid not null` を追加し、`unique (owner_id, name)` を検討。`status` と `updated_at` カラムを追加。
- `time_tracker_sessions` に `theme_id uuid`, `project_id uuid`, `classification_path text[]` 追加。
- バックフィル: `theme_id` と `project_id` が未設定のセッションはデフォルトテーマに割当し、既存の `project` 文字列ごとに Project レコードを生成して参照させる。`classification_path = ARRAY[default_theme_id, project_id]`（project 未設定の場合はテーマのみ）; 旧 `archived_at` が存在する行は `status = 'archived'`, `updated_at = archived_at` に更新し、未設定は `status = 'active'` のまま。
- ランニングステート (`time_tracker_running_states`) の `draft` JSON に `themeId`, `projectId`, `classificationPath` を許容。

### External Integrations — Google Sheets
- `googleSyncTypes.TimeTrackerRow` に `theme: string | null` を追加（`project` は既存のまま）。
- エクスポート: テーマ未設定の場合は `''` を書き込み、Project 列の値は従来通り。
- インポート: 新しい Theme 列が存在する場合は `theme` に読み込み、列が欠如している旧テンプレートでは `null` として扱うフォールバックを実装。

### Validation Rules
- Theme: `ownerId` を必須とし、同一 `ownerId` 内で name 重複禁止（ケースインセンシティブ）。
- Project: `ownerId` を必須とし、同一 `ownerId` + `themeId` コンテキストで name 重複禁止。
- classificationPath: 配列長 >= 1（themeId が null の場合はプロジェクト ID のみ）。今後の追加階層では配列長を増やす。

### Future Extension Hooks
- `classificationPath` に追加 ID を push するだけで 3 階層以上に対応可能。
- Theme と Project に `order` フィールドを追加すればドラッグ&ドロップ並び替えを実装しやすい。
