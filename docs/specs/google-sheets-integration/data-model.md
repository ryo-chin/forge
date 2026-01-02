# Data Model — Google Spreadsheet Integration

## 1. 既存エンティティ（前提）

### TimeTrackerSession (既存)
- **主キー**: `id` (UUID)
- **属性**:
  - `userId` (UUID) — Supabase ユーザー ID
  - `title` (string, required)
  - `startedAt` (number, epoch millis, required)
  - `endedAt` (number, epoch millis, required)
  - `durationSeconds` (number, >= 0, required)
  - `project` (string, optional)
  - `notes` (string, optional)
  - `tags` (string[], optional)
  - `skill` (string, optional)
  - `intensity` (string, optional)
- **保存先**: Supabase `time_tracker_sessions`
- **制約**:
  - `endedAt >= startedAt`
  - `durationSeconds = (endedAt - startedAt) / 1000` と一致

### RunningSessionState (既存)
- **主キー**: `userId`
- **属性**:
  - `status` (`'idle' | 'running'`)
  - `draft` (SessionDraft | null)
  - `elapsedSeconds` (number)
- **保存先**: Supabase `time_tracker_running_states`

## 2. 新規エンティティ

### GoogleSpreadsheetConnection
- **主キー**: `id` (UUID)
- **属性**:
  - `userId` (UUID, unique, not null) — Supabase ユーザーと 1:1
  - `googleUserId` (string, not null) — `sub` クレーム
  - `spreadsheetId` (string, nullable until selection)
  - `sheetId` (number, nullable until selection)
  - `sheetTitle` (string, cached display name, optional)
  - `accessToken` (encrypted string, not null)
  - `refreshToken` (encrypted string, not null)
  - `accessTokenExpiresAt` (timestamp with time zone, not null)
  - `scopes` (string[], default `['https://www.googleapis.com/auth/spreadsheets']`)
  - `status` (`'active' | 'revoked' | 'error'`, default `'active'`)
  - `createdAt` / `updatedAt` (timestamp)
- **保存先候補**: Supabase `google_spreadsheet_connections`
- **検証**:
  - `spreadsheetId`, `sheetId` は P1 段階では必須（同期有効化前に設定画面で完了させる）
  - `status != 'active'` の場合は同期 API が 409 を返す

### ColumnMappingConfiguration
- **主キー**: `id` (UUID)
- **外部キー**: `connectionId` → `GoogleSpreadsheetConnection.id`
- **属性**:
  - `mappings` (JSONB) — `{ title: 'A', startedAt: 'B', ... }` 形式
  - `requiredColumns` (string[], default `['title','startedAt','endedAt','durationSeconds']`)
  - `optionalColumns` (string[], default `['project','notes','tags','skill','intensity']`)
  - `createdAt` / `updatedAt`
- **制約**:
  - `mappings` 内の値は重複禁止
  - `requiredColumns` のキーは全て `mappings` に存在すること (P2 要件)
  - カラム名はシート 1 行目に存在するヘッダーと一致する必要あり（同期前検証）
- **保存先候補**: Supabase `google_spreadsheet_column_mappings`

### SyncLog
- **主キー**: `id` (UUID)
- **外部キー**:
  - `connectionId` → `GoogleSpreadsheetConnection.id`
  - `sessionId` → `time_tracker_sessions.id`
- **属性**:
  - `status` (`'success' | 'failed' | 'pending'`)
  - `attemptedAt` (timestamp)
  - `failureReason` (string, optional)
  - `googleAppendRequest` (JSONB, optional,トレース用)
  - `googleAppendResponse` (JSONB, optional,トレース用)
  - `retryCount` (number, default 0)
- **制約**:
  - `connectionId + sessionId` でユニーク（1 セッション 1 同期が原則）
  - `status='success'` の場合 `failureReason` は null
- **保存先候補**: Supabase `google_sync_logs`

### ManualExportJob (P3 先行定義)
- **主キー**: `id` (UUID)
- **外部キー**: `connectionId`
- **属性**:
  - `sessionIds` (UUID[])
  - `status` (`'queued' | 'running' | 'success' | 'failed'`)
  - `requestedAt` / `completedAt`
- **備考**: P3 で利用。現段階ではスキーマのみ定義。

## 3. リレーション

- `User (Supabase)` 1 — 1 `GoogleSpreadsheetConnection`
- `GoogleSpreadsheetConnection` 1 — 1 `ColumnMappingConfiguration`
- `GoogleSpreadsheetConnection` 1 — n `SyncLog`
- `TimeTrackerSession` 1 — 0..1 `SyncLog`
- `GoogleSpreadsheetConnection` 1 — n `ManualExportJob` (P3)

## 4. 状態遷移とビジネスルール

### GoogleSpreadsheetConnection
1. **`revoked` → `active`**: OAuth コード交換完了時に `accessToken`, `refreshToken` を保存し、ステータスを `active` に更新。
2. **`active` → `error`**: Google API が 401/403 を返却した場合。`SyncLog` に失敗を記録し、UI には再認証を要求。
3. **`active` → `revoked`**: ユーザーが連携解除した場合。トークンを無効化し、同期キューを停止。

### 同期フロー
1. Time Tracker セッション停止 → UI から Worker `POST /integrations/google/sync` にリクエスト。
2. Worker は `SyncLog` を `pending` で作成し、`GoogleSpreadsheetConnection` + `ColumnMappingConfiguration` を読み込み。
3. Google Sheets API `append` 成功 → `SyncLog.status = success`。失敗時は `failed` と詳細を格納。
4. `failed` 状態のログは UI で再同期（PATCH）をトリガーできるようにする。

### ColumnMappingConfiguration
- P2 でユーザーが保存した瞬間に `requiredColumns` すべてに対するバリデーションを行う。
- カラム名変更時は `mappings` を更新し `updatedAt` を反映。

## 5. バリデーション規則

- Spreadsheet/Sheet 選択:
  - `spreadsheetId`, `sheetId` は同期有効化前に必須
  - `sheetId` は Google Sheets API から返る正の整数
- 文字列フィールド:
  - `title`, `project` などは 256 文字以内
  - カラム名は `[A-Z]{1,3}`（列記号） or 既存ヘッダー文字列をサポート。ヘッダー文字列は 128 文字以内
- Token 有効期限:
  - `accessTokenExpiresAt` の 5 分前を閾値にリフレッシュを実行
- 同期成功条件:
  - DB への `persistSessions` が成功しなかった場合は Worker 呼び出し自体を行わない
  - Worker 側は idempotency key (`sessionId`) で重複 append を防止する

## 6. 将来拡張の余地

- `google_spreadsheet_connections` に `scopes` カラムを保持しておくことで Drive API 等への拡張が容易。
- `ManualExportJob` を用いて履歴セッションの一括再エクスポートに対応可能。
- `SyncLog` に `rowNumber` を保持すると後続デバッグが容易になる（Google API レスポンスに含まれる）。

