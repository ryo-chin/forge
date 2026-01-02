# API Contract: Google Sheets Running Session同期

**Feature**: 004-running-session-running
**Date**: 2025-10-19
**Phase**: Phase 1 - Design & Contracts

## Overview

Google Sheets APIを使用してRunning中のセッション情報を同期するためのインターフェース定義。既存の`googleSyncClient.ts`を拡張する。

---

## Client Interface

### GoogleSyncClient (拡張)

既存の`GoogleSyncClient`に以下のメソッドを追加。

```typescript
interface GoogleSyncClient {
  // 既存メソッド（完了セッション同期用）
  appendSessions(sessions: TimeTrackerSession[]): Promise<void>;
  updateSessions(sessions: TimeTrackerSession[]): Promise<void>;

  // 【新規】Running状態同期用メソッド
  appendRunningSession(draft: SessionDraft, options: GoogleSpreadsheetOptions): Promise<void>;
  updateRunningSession(draft: SessionDraft, options: GoogleSpreadsheetOptions): Promise<void>;
  completeRunningSession(session: TimeTrackerSession, options: GoogleSpreadsheetOptions): Promise<void>;
}
```

---

## Method Specifications

### appendRunningSession

Running中のセッションを新しい行として追加する。

**Signature**:
```typescript
appendRunningSession(
  draft: SessionDraft,
  options: GoogleSpreadsheetOptions
): Promise<void>
```

**Parameters**:
- `draft`: Running中のセッション情報（id含む）
- `options`: スプレッドシートID、シート名、列マッピング

**Behavior**:
1. `draft.id`が未設定の場合はエラー
2. `spreadsheets.values.append` APIを使用
3. 以下の値を設定:
   - id: `draft.id`
   - status: "Running"
   - title: `draft.title`
   - startedAt: `draft.startedAt`（ISO 8601形式に変換）
   - endedAt: ""（空文字）
   - durationSeconds: 0または""
   - project, tags, skill, intensity, notes: `draft`から取得（未設定は""）

**Google Sheets API Call**:
```javascript
const values = [[
  draft.id,                // id列
  'Running',               // status列
  draft.title,             // title列
  new Date(draft.startedAt).toISOString(),  // startedAt列
  '',                      // endedAt列（空）
  '',                      // durationSeconds列（空）
  draft.project || '',     // project列
  (draft.tags || []).join(','),  // tags列
  draft.skill || '',       // skill列
  draft.intensity || '',   // intensity列
  draft.notes || '',       // notes列
]];

await gapi.client.sheets.spreadsheets.values.append({
  spreadsheetId: options.spreadsheetId,
  range: `${options.sheetName}!A:K`,  // 列範囲は動的に決定
  valueInputOption: 'USER_ENTERED',
  resource: { values },
});
```

**Error Handling**:
- API呼び出し失敗: エラーログ出力、Promiseをreject
- `id`未設定: エラーをthrow
- ネットワークエラー: エラーログ、ベストエフォート（リトライなし）

---

### updateRunningSession

Running中のセッション情報を更新する。

**Signature**:
```typescript
updateRunningSession(
  draft: SessionDraft,
  options: GoogleSpreadsheetOptions
): Promise<void>
```

**Parameters**:
- `draft`: 更新後のセッション情報（id含む）
- `options`: スプレッドシートID、シート名、列マッピング

**Behavior**:
1. `draft.id`でRunning行を検索
   - id列でセッションを一意に特定
   - 見つからない場合: status="Running"の最新行を使用（フォールバック）
2. 該当行が見つからない場合はエラーログ、処理スキップ
3. `spreadsheets.values.batchUpdate` APIで以下を更新:
   - title: `draft.title`
   - project, tags, skill, intensity, notes: `draft`から取得
   - durationSeconds: 現在時刻 - startedAt（秒単位）
   - status, id, startedAt, endedAtは更新しない

**Google Sheets API Call**:
```javascript
// 1. 行検索（id列を読み取り）
const idColumnRange = `${options.sheetName}!${options.idColumn}:${options.idColumn}`;
const searchResult = await gapi.client.sheets.spreadsheets.values.get({
  spreadsheetId: options.spreadsheetId,
  range: idColumnRange,
});

const rowIndex = searchResult.result.values?.findIndex(
  row => row[0] === draft.id
);

if (rowIndex === -1) {
  console.warn('[Google Sheets] Running session not found:', draft.id);
  return;
}

// 2. 更新（該当行のみ）
const updates = [
  {
    range: `${options.sheetName}!${options.titleColumn}${rowIndex + 1}`,
    values: [[draft.title]],
  },
  {
    range: `${options.sheetName}!${options.projectColumn}${rowIndex + 1}`,
    values: [[draft.project || '']],
  },
  // ... 他のフィールドも同様
];

await gapi.client.sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: options.spreadsheetId,
  resource: { data: updates, valueInputOption: 'USER_ENTERED' },
});
```

**Error Handling**:
- 行が見つからない: ログ出力、処理スキップ
- API呼び出し失敗: エラーログ、Promiseをreject

---

### completeRunningSession

Running中のセッションを完了状態に変更する。

**Signature**:
```typescript
completeRunningSession(
  session: TimeTrackerSession,
  options: GoogleSpreadsheetOptions
): Promise<void>
```

**Parameters**:
- `session`: 完了したセッション情報（同じIDを含む）
- `options`: スプレッドシートID、シート名、列マッピング

**Behavior**:
1. `session.id`でRunning行を検索
2. 該当行を以下の値で更新:
   - status: "Completed"
   - endedAt: `session.endedAt`（ISO 8601形式）
   - durationSeconds: `session.durationSeconds`
   - その他フィールド: `session`から取得（最終確定値）

**Google Sheets API Call**:
```javascript
// 行検索（updateRunningSessionと同様）
const rowIndex = /* session.idで検索 */;

// 更新
const updates = [
  {
    range: `${options.sheetName}!${options.statusColumn}${rowIndex + 1}`,
    values: [['Completed']],
  },
  {
    range: `${options.sheetName}!${options.endedAtColumn}${rowIndex + 1}`,
    values: [[new Date(session.endedAt).toISOString()]],
  },
  {
    range: `${options.sheetName}!${options.durationColumn}${rowIndex + 1}`,
    values: [[session.durationSeconds]],
  },
  // ... 他のフィールドも同様
];

await gapi.client.sheets.spreadsheets.values.batchUpdate({
  spreadsheetId: options.spreadsheetId,
  resource: { data: updates, valueInputOption: 'USER_ENTERED' },
});
```

**Error Handling**:
- 行が見つからない: ログ出力、処理スキップ
- API呼び出し失敗: エラーログ、Promiseをreject

---

## Type Definitions

### GoogleSpreadsheetOptions (拡張)

既存の`GoogleSpreadsheetOptions`に新しい列マッピングを追加。

```typescript
type GoogleSpreadsheetOptions = {
  spreadsheetId: string;
  sheetName: string;

  // 既存列マッピング
  titleColumn: string;
  startedAtColumn: string;
  endedAtColumn: string;
  durationColumn: string;
  projectColumn?: string;
  tagsColumn?: string;

  // 【新規】Running状態用列マッピング
  idColumn?: string;        // セッションID列（UUIDを格納）
  statusColumn?: string;    // ステータス列（"Running" | "Completed"）

  // その他既存フィールド
  skillColumn?: string;
  intensityColumn?: string;
  notesColumn?: string;
};
```

---

## Usage Example

### セッション開始時

```typescript
import { googleSyncClient } from '@infra/google';

const draft: SessionDraft = {
  id: crypto.randomUUID(),
  title: '資料作成',
  startedAt: Date.now(),
  tags: ['重要'],
  project: '新規事業',
};

const options: GoogleSpreadsheetOptions = {
  spreadsheetId: 'abc123',
  sheetName: 'Sessions',
  idColumn: 'A',
  statusColumn: 'B',
  titleColumn: 'C',
  startedAtColumn: 'D',
  endedAtColumn: 'E',
  durationColumn: 'F',
  projectColumn: 'G',
  tagsColumn: 'H',
};

await googleSyncClient.appendRunningSession(draft, options);
// → Google Sheetsに新しい行を追加、status="Running"
```

### セッション編集時

```typescript
const updatedDraft: SessionDraft = {
  ...draft,
  project: '新規事業（優先度高）',
  tags: ['重要', '緊急'],
};

// debounce後に実行
await googleSyncClient.updateRunningSession(updatedDraft, options);
// → Google Sheetsの該当行を更新
```

### セッション停止時

```typescript
const completedSession: TimeTrackerSession = {
  id: draft.id,  // Running時と同じIDを使用
  title: '資料作成',
  startedAt: draft.startedAt,
  endedAt: Date.now(),
  durationSeconds: 3600,
  project: '新規事業（優先度高）',
  tags: ['重要', '緊急'],
};

await googleSyncClient.completeRunningSession(
  completedSession,
  options
);
// → status="Completed"に変更、終了情報確定
```

---

## Rate Limiting & Throttling

### API呼び出し制限

Google Sheets API: **100リクエスト/分**

### 対策

1. **Debounce**（編集時）:
   ```typescript
   const debouncedUpdate = debounce(
     (draft: SessionDraft) => googleSyncClient.updateRunningSession(draft, options),
     1000  // 1秒待機
   );
   ```

2. **バッチ更新**:
   - `batchUpdate` APIを使用し、1回のリクエストで複数セル更新

3. **自動ポーリングなし**:
   - 経過時間の自動更新は行わない
   - ユーザーの明示的なアクション（リロード）時のみ更新

---

## Error Scenarios

| シナリオ | 動作 | ユーザーへの影響 |
|---------|------|------------------|
| ネットワークエラー | エラーログ、処理スキップ | Google Sheets未同期、アプリ内では正常動作 |
| API制限超過（429） | エラーログ、リトライなし | 一時的に同期失敗、次回リロード時に再試行可能 |
| スプレッドシートが削除された | エラーログ、処理スキップ | 設定画面で再設定が必要 |
| id列が見つからない | status="Running"で検索、最新行を使用 | 正常動作（フォールバック） |
| Running行が見つからない | ログ出力、処理スキップ | 次回セッション開始時に新しい行を作成 |

---

## Testing Strategy

### ユニットテスト

```typescript
describe('googleSyncClient', () => {
  describe('appendRunningSession', () => {
    it('should append a new row with status="Running"', async () => {
      const mockAppend = vi.fn().mockResolvedValue({});
      gapi.client.sheets.spreadsheets.values.append = mockAppend;

      await googleSyncClient.appendRunningSession(draft, options);

      expect(mockAppend).toHaveBeenCalledWith(
        expect.objectContaining({
          resource: { values: [['uuid', 'Running', ...]] },
        })
      );
    });
  });
});
```

### E2Eテスト

```typescript
test('should sync running session to Google Sheets', async ({ page }) => {
  // Google Sheets APIをモック
  await page.route('**/sheets/v4/**', (route) => {
    route.fulfill({ status: 200, body: '{}' });
  });

  await page.goto('/time-tracker');
  await page.fill('input[name="title"]', '資料作成');
  await page.click('button[type="submit"]');  // セッション開始

  // APIが呼ばれたことを確認
  const requests = await page.evaluate(() => window.__apiRequests);
  expect(requests).toContainEqual(
    expect.objectContaining({ method: 'append', status: 'Running' })
  );
});
```

---

## Summary

- **新規メソッド**: `appendRunningSession`, `updateRunningSession`, `completeRunningSession`
- **拡張型定義**: `GoogleSpreadsheetOptions`に`idColumn`, `statusColumn`追加
- **Immutable Design**: セッションIDは開始時に一度だけ生成、完了まで変更なし
- **API制限対策**: debounce、バッチ更新、自動ポーリングなし
- **エラーハンドリング**: ベストエフォート、ログ出力のみ
- **テスト**: ユニット・E2E両方でカバー
