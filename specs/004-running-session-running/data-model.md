# Data Model: Running Session同期機能

**Feature**: 004-running-session-running
**Date**: 2025-10-19
**Phase**: Phase 1 - Design & Contracts

## Overview

Running Session同期機能のデータモデル定義。既存のエンティティを活用し、最小限の拡張のみ行う。

## Core Entities

### SessionDraft (拡張)

Running中のセッション情報。既存の定義に`id`を追加。

```typescript
type SessionDraft = {
  id: string;             // 【新規】セッションの一意識別子（UUID、開始時に生成）
  title: string;          // セッションタイトル
  startedAt: number;      // 開始時刻（Unix timestamp, milliseconds）
  tags?: string[];        // タグ
  project?: string;       // プロジェクト名
  skill?: string;         // スキル
  intensity?: number;     // 強度（1-5）
  notes?: string;         // メモ
};
```

**変更点**:
- `id`: セッション開始時に`crypto.randomUUID()`で生成する一意識別子
- Running状態から完了状態まで同じIDを維持（immutable設計）
- Google SheetsやSupabaseでセッションを一貫して識別可能

**バリデーション**:
- `id`: 必須、UUID形式
- `title`: 必須、非空文字列
- `startedAt`: 必須、正の整数

---

### RunningSessionState (既存、変更なし)

Running中のセッション全体の状態。

```typescript
type RunningSessionState = {
  status: 'idle' | 'running';
  draft: SessionDraft | null;
  elapsedSeconds: number;
};
```

**状態遷移**:
- `idle` → `running`: セッション開始時
- `running` → `idle`: セッション停止時
- `running` → `running`: セッション編集時

---

### Google Sheets Row Structure

Google Sheetsに同期されるRunning Session情報の構造。

```typescript
type GoogleSheetsRunningRow = {
  id: string;                  // セッションID（開始時に生成、完了後も同じID）
  status: 'Running' | 'Completed';  // ステータス
  title: string;               // タイトル
  startedAt: string;           // 開始時刻（ISO 8601形式）
  endedAt: string | '';        // 終了時刻（Running時は空文字）
  durationSeconds: number | '';  // 合計時間（Running時は空または経過時間）
  project: string | '';        // プロジェクト
  tags: string | '';           // タグ（カンマ区切り）
  skill: string | '';          // スキル
  intensity: number | '';      // 強度
  notes: string | '';          // メモ
};
```

**列マッピング**:
ユーザーが`ColumnMappingForm`で以下の列を設定:
- `idColumn`: セッションID列（新規）
- `statusColumn`: ステータス列（新規）
- `titleColumn`: タイトル列（既存）
- `startedAtColumn`: 開始時刻列（既存）
- `endedAtColumn`: 終了時刻列（既存）
- `durationColumn`: 合計時間列（既存）
- `projectColumn`: プロジェクト列（既存）
- `tagsColumn`: タグ列（既存）
- その他フィールドも同様

**更新パターン**:
1. **セッション開始時**: 新しい行を追加（appendRow）
   - status="Running", endedAt='', durationSeconds=0
2. **セッション編集時**: 該当行を更新（updateRow）
   - title, project, tags, skill, intensity, notesのみ更新
3. **リロード時**: 経過時間を更新（updateRow）
   - durationSecondsのみ更新
4. **セッション停止時**: ステータスと終了情報を確定（updateRow）
   - status="Completed", endedAt, durationSecondsを確定

---

## Data Flow

### P1: デバイス間同期（Supabase）

```
Device A                    Supabase                    Device B
   |                           |                           |
   |--- start session -------->|                           |
   |<-- persist success -------|                           |
   |                           |                           |
   |                           |<--- fetch on mount -------|
   |                           |---- return state -------->|
   |                           |                           |
   |--- update draft --------->|                           |
   |<-- persist success -------|                           |
   |                           |                           |
   |                           |<--- fetch on reload ------|
   |                           |---- return updated ------>|
```

**使用テーブル**: `time_tracker_running_states` (既存)

**スキーマ**:
```sql
CREATE TABLE time_tracker_running_states (
  user_id UUID PRIMARY KEY,
  status TEXT NOT NULL,
  draft JSONB,
  elapsed_seconds INTEGER
);
```

---

### P2: Google Sheets同期

```
App                         Google Sheets API
 |                                |
 |--- start session ------------->|
 |    appendRow(Running)          |
 |<-- row added ------------------|
 |                                |
 |--- update draft -------------->|
 |    updateRow(tempId, fields)   |
 |<-- row updated ----------------|
 |                                |
 |--- stop session -------------->|
 |    updateRow(tempId, status)   |
 |<-- row completed --------------|
```

**API呼び出し**:
- `spreadsheets.values.append`: セッション開始時
- `spreadsheets.values.batchUpdate`: 編集・リロード・停止時

---

## Validation Rules

### SessionDraft

| フィールド | 必須 | バリデーション |
|-----------|------|----------------|
| tempId | No | UUID形式（v4） |
| title | Yes | 非空文字列、トリム後1文字以上 |
| startedAt | Yes | 正の整数、`Date.now()`以下 |
| tags | No | 文字列配列、各要素は非空 |
| project | No | 文字列、トリム後非空または空 |
| skill | No | 文字列 |
| intensity | No | 1-5の整数 |
| notes | No | 文字列 |

### Google Sheets Row

| フィールド | 値 | 備考 |
|-----------|---|------|
| status | "Running" \| "Completed" | 必須 |
| tempId | UUID | Running時は必須、Completed後はそのまま保持 |
| endedAt | ISO 8601 \| '' | Running時は空文字 |
| durationSeconds | number \| '' | Running時は経過時間または空 |

---

## State Transitions

### Running Session State

```
┌──────┐  start()   ┌─────────┐
│ idle │─────────→ │ running │
└──────┘            └─────────┘
   ↑                    │
   │       stop()       │
   └────────────────────┘
```

**トリガー**:
- `start(title)`: idle → running
- `stop()`: running → idle
- `updateDraft(partial)`: running → running (内部更新)
- `RESTORE(state)`: any → any (サーバーから復元)

### Google Sheets Row Status

```
┌──────────────┐  stop session  ┌─────────────┐
│ Running      │───────────────→│ Completed   │
└──────────────┘                └─────────────┘
```

**トリガー**:
- セッション開始: Row作成、status="Running"
- セッション停止: status="Completed"、終了情報確定

---

## Edge Cases & Constraints

### 同時編集（Last Write Wins）

複数デバイスで同じRunning Sessionを編集した場合:
- Supabase: 最後に`persistRunningState()`を実行した状態が優先
- Google Sheets: 最後に`batchUpdate`を実行した変更が反映

**実装**:
- タイムスタンプベースの競合解決なし（シンプルにLast Write Wins）
- デバイスBがリロードすると、デバイスAの最新状態で上書き

### Running行の検索

Google Sheetsで該当のRunning行を見つける方法:
1. `id`列を検索（セッションIDで一意に特定）
2. 見つからない場合は`status="Running"`でフィルタして最新行を使用
3. それでも見つからない場合はエラーログ、ベストエフォート（同期スキップ）

### データ整合性

- Supabase: user_id単位で1つのRunning状態のみ保持（primary key制約）
- Google Sheets: 複数Running行が存在する可能性（手動編集時）
  - 最新の行を優先（行番号が大きい方）

---

## Migration & Backward Compatibility

### SessionDraft への id 追加

**既存データへの影響**:
- `id`は必須フィールドのため、既存のSessionDraftに対してはマイグレーションが必要
- セッション開始時に必ずIDを生成するようにロジックを変更

**マイグレーション**:
- 既存のRunning中セッションがある場合、リロード時にIDを生成
- `useRunningSession`のRESTOREアクションでIDがない場合は新規生成

### LocalStorage モード

- LocalStorageモードでも`id`を生成（完了セッションとの一貫性のため）
- Supabase/Google Sheetsモードと同じID生成ロジックを使用

**後方互換性**:
- Running中セッションのみ影響（リロード時にIDが新規生成される）
- 完了済みセッションは影響なし（既にIDを持っている）

---

## Performance Considerations

### Google Sheets API呼び出し頻度

**制限**: 100リクエスト/分

**対策**:
- 編集時の更新はdebounce（1秒）
- 経過時間の自動更新なし（リロード時のみ）
- バッチ更新APIを使用（1回のリクエストで複数セル更新）

**想定頻度**:
- セッション開始: 1リクエスト
- 編集（debounce後）: 最大60リクエスト/分
- リロード: 1リクエスト
- セッション停止: 1リクエスト

合計: 通常運用で63リクエスト/分以下（制限内）

---

## Summary

- **SessionDraft**: `id`フィールドを追加（必須、開始時に生成）
- **RunningSessionState**: 変更なし
- **Google Sheets Row**: id, status列を追加
- **Supabase**: 既存テーブルをそのまま使用
- **バリデーション**: id, title必須、その他オプショナル
- **状態遷移**: idle ↔ running, Running → Completed
- **競合解決**: Last Write Wins
- **Immutable Design**: IDは開始時に一度だけ生成、完了まで変更なし
