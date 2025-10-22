# Quickstart: Running Session同期機能

**Feature**: 004-running-session-running
**Date**: 2025-10-19
**Audience**: 開発者

## Overview

このガイドでは、Running Session同期機能の開発環境セットアップと実装済み機能の検証方法を説明します。

**実装状況**: ✅ 完了（Phase 1-4）
- P1: Supabaseデバイス間同期
- P2: Google Sheets Running同期
- 全テスト: 91成功、5スキップ

---

## Prerequisites

- Node.js 18+ インストール済み
- `app/` ディレクトリで `npm install` 実行済み
- Supabaseプロジェクト作成済み（`time_tracker_running_states` テーブルあり）
- Google Cloud Platformプロジェクト作成済み（Sheets API有効化）

---

## Setup

### 1. ブランチの確認

```bash
git checkout 004-running-session-running
git pull origin 004-running-session-running
```

### 2. 依存関係のインストール

```bash
cd app
npm install
```

### 3. 環境変数の設定

`app/.env.development` に以下を設定（既存の設定を確認）:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Google Sheets API
VITE_GOOGLE_API_KEY=your-api-key
VITE_GOOGLE_CLIENT_ID=your-client-id
```

### 4. Supabaseテーブルの確認

`time_tracker_running_states` テーブルが存在することを確認:

```sql
SELECT * FROM time_tracker_running_states LIMIT 1;
```

存在しない場合は以下で作成（※既に存在する可能性が高い）:

```sql
CREATE TABLE time_tracker_running_states (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('idle', 'running')),
  draft JSONB,
  elapsed_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE time_tracker_running_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own running state"
  ON time_tracker_running_states FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own running state"
  ON time_tracker_running_states FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own running state"
  ON time_tracker_running_states FOR UPDATE
  USING (auth.uid() = user_id);
```

### 5. Google Sheetsの列設定（P2実装時）

Google Sheets同期機能（P2）を使用する場合、スプレッドシートに以下の列を追加してください。

#### 必要な列

| 列名 | 説明 | 例 |
|-----|------|-----|
| Session ID | セッションの一意識別子（開始時に生成、完了後も同じID） | `a1b2c3d4-...` |
| Status | セッションのステータス | `Running` / `Completed` |
| Title | セッションタイトル | `資料作成` |
| Started At | 開始時刻（ISO 8601形式） | `2025-10-19T10:30:00Z` |
| Ended At | 終了時刻（Running時は空） | `2025-10-19T12:30:00Z` |
| Duration (seconds) | 合計時間（秒単位） | `7200` |
| Project | プロジェクト名 | `新規事業` |
| Tags | タグ（カンマ区切り） | `重要,緊急` |
| Skill | スキル | `TypeScript` |
| Intensity | 強度（1-5） | `4` |
| Notes | メモ | `資料のドラフト作成` |

#### 列マッピングの設定例

アプリの設定画面で以下のように列を指定します:

```typescript
const columnMapping = {
  spreadsheetId: 'your-spreadsheet-id',
  sheetName: 'Sessions',
  idColumn: 'A',           // 【新規】Session ID列
  statusColumn: 'B',       // 【新規】Status列
  titleColumn: 'C',
  startedAtColumn: 'D',
  endedAtColumn: 'E',
  durationColumn: 'F',
  projectColumn: 'G',
  tagsColumn: 'H',
  skillColumn: 'I',
  intensityColumn: 'J',
  notesColumn: 'K',
};
```

#### データの流れ

Session IDは以下のように一貫して使用されます:

1. **セッション開始時**: アプリ内で`crypto.randomUUID()`でID生成
2. **Running中**: 同じIDで行を識別・更新
3. **セッション完了時**: 同じIDのまま`status`を`Completed`に変更

**重要**: Session IDは開始時に一度だけ生成され、Running状態から完了状態まで変わりません。これにより、セッションのライフサイクル全体を追跡できます。

---

## Development Workflow

### Phase 1: P1（デバイス間同期）

#### ステップ1: 既存実装の確認

```bash
# Supabase同期の既存実装を確認
cat app/src/infra/repository/TimeTracker/supabaseDataSource.ts
cat app/src/features/time-tracker/hooks/data/useRunningSession.ts
```

確認ポイント:
- `fetchRunningState()`: サーバーから状態を取得
- `persistRunningState()`: サーバーに状態を保存
- `useRunningSession`のuseEffect: マウント時・状態変更時の同期ロジック

#### ステップ2: テストの作成（TDD）

```bash
# テストファイルを作成（まだ存在しない場合）
touch app/src/features/time-tracker/hooks/data/__tests__/useRunningSession.sync.test.tsx
```

テスト例:
```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useRunningSession } from '../useRunningSession';
import { createTimeTrackerDataSource } from '@infra/repository/TimeTracker';

vi.mock('@infra/repository/TimeTracker');

describe('useRunningSession - Supabase Sync', () => {
  it('should fetch running state on mount', async () => {
    const mockDataSource = {
      mode: 'supabase',
      initialRunningState: null,
      fetchRunningState: vi.fn().mockResolvedValue({
        status: 'running',
        draft: { title: 'Test', startedAt: Date.now() },
        elapsedSeconds: 100,
      }),
      persistRunningState: vi.fn(),
    };

    createTimeTrackerDataSource.mockReturnValue(mockDataSource);

    const { result } = renderHook(() => useRunningSession({ userId: 'user-1' }));

    await waitFor(() => {
      expect(result.current.state.status).toBe('running');
      expect(result.current.state.draft?.title).toBe('Test');
    });
  });
});
```

#### ステップ3: テスト実行（Red）

```bash
npm run test -- useRunningSession.sync.test.tsx
```

既存実装が正しければテストは **Green** になるはず。もしFailなら実装を修正。

#### ステップ4: E2Eテストの作成

```bash
touch app/tests/e2e/running-session-sync.spec.ts
```

E2E例:
```typescript
import { test, expect } from '@playwright/test';

test('should sync running session across devices', async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();

  // Device A: セッション開始
  await pageA.goto('http://localhost:5173/time-tracker');
  await pageA.fill('input[name="title"]', '資料作成');
  await pageA.click('button[aria-label="Start session"]');

  // Device B: リロードして同期確認
  await pageB.goto('http://localhost:5173/time-tracker');
  await expect(pageB.locator('text=資料作成')).toBeVisible();
  await expect(pageB.locator('[data-testid="running-status"]')).toHaveText('Running');

  await contextA.close();
  await contextB.close();
});
```

#### ステップ5: E2E実行

```bash
npm run test:e2e -- running-session-sync.spec.ts
```

---

### Phase 2: P2（Google Sheets同期）

#### ステップ1: データモデル拡張

```bash
# SessionDraftにidを追加
vim app/src/features/time-tracker/domain/types.ts
```

変更内容:
```typescript
export type SessionDraft = {
  id: string;       // 【追加】開始時に生成する一意識別子（UUID）
  title: string;
  startedAt: number;
  tags?: string[];
  project?: string;
  skill?: string;
  intensity?: 'low' | 'medium' | 'high';  // 実装済み: リテラル型
  notes?: string;
};
```

#### ステップ2: Google Sheets Running Syncの実装（TDD）

**実装済みファイル**: `app/src/infra/google/googleSheetsRunningSync.ts`

```bash
# テストファイル（実装済み）
cat app/src/infra/google/__tests__/googleSheetsRunningSync.test.ts
```

テスト例:
```typescript
import { appendRunningSession, updateRunningSession, completeRunningSession } from '../googleSheetsRunningSync';

describe('googleSyncClient - Running Session', () => {
  it('should append running session to Google Sheets', async () => {
    const mockAppend = vi.fn().mockResolvedValue({});
    global.gapi = {
      client: {
        sheets: {
          spreadsheets: {
            values: { append: mockAppend },
          },
        },
      },
    };

    const draft = {
      id: 'uuid-123',
      title: '資料作成',
      startedAt: Date.now(),
    };

    const options = {
      spreadsheetId: 'sheet-id',
      sheetName: 'Sessions',
      idColumn: 'A',
      statusColumn: 'B',
      titleColumn: 'C',
    };

    await appendRunningSession(draft, options);

    expect(mockAppend).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: {
          values: [[draft.id, 'Running', draft.title, /* ... */]],
        },
      })
    );
  });
});
```

#### ステップ3: 実装（✅ 完了）

**実装済みファイル**: `app/src/infra/google/googleSheetsRunningSync.ts`

```bash
# 実装の確認
cat app/src/infra/google/googleSheetsRunningSync.ts
```

実装済みメソッド:
```typescript
// 新しいモジュールとして分離実装
export async function appendRunningSession(draft: SessionDraft, options: GoogleSheetsOptions) {
    if (!draft.id) {
      throw new Error('id is required for running session');
    }

    const values = [[
      draft.id,
      'Running',
      draft.title,
      new Date(draft.startedAt).toISOString(),
      '', // endedAt
      '', // durationSeconds
      draft.project || '',
      (draft.tags || []).join(','),
      draft.skill || '',
      draft.intensity || '',
      draft.notes || '',
    ]];

    await gapi.client.sheets.spreadsheets.values.append({
      spreadsheetId: options.spreadsheetId,
      range: `${options.sheetName}!A:K`,
      valueInputOption: 'USER_ENTERED',
      resource: { values },
    });
  },
};

// その他のメソッド（実装済み）
// - updateRunningSession(draft, options)
// - completeRunningSession(session, options)
// 詳細: app/src/infra/google/googleSheetsRunningSync.ts を参照
```

#### ステップ4: フックの拡張（✅ 完了）

**実装済みファイル**: `app/src/features/time-tracker/hooks/data/useGoogleSpreadsheetSync.ts`

Running同期メソッドが追加済み:
- `syncRunningSessionStart(draft)`: セッション開始時
- `syncRunningSessionUpdate(draft)`: セッション更新時（debounce 1秒）
- `syncRunningSessionComplete(session)`: セッション完了時

```bash
# 実装の確認
grep -A 10 "syncRunningSession" app/src/features/time-tracker/hooks/data/useGoogleSpreadsheetSync.ts
```

#### ステップ5: E2Eテスト（✅ 完了）

**実装済みファイル**:
- `app/tests/e2e/running-session-sync.spec.ts` （14テスト）
- `app/tests/e2e/google-sheets-sync.spec.ts` （12テスト）

```bash
# E2Eテストの実行
npm run test:e2e -- running-session-sync
npm run test:e2e -- google-sheets-sync
```

---

## Testing

### ユニットテスト実行

```bash
npm run test
```

特定ファイルのみ:
```bash
npm run test -- useRunningSession
npm run test -- googleSheetsRunningSync
```

### E2Eテスト実行

```bash
npm run test:e2e
```

特定のスペックのみ:
```bash
npm run test:e2e -- running-session-sync.spec.ts
```

### カバレッジ確認

```bash
npm run test:coverage
```

目標:
- ドメインロジック: 100%
- Hooks: 90%以上
- E2E: 主要フロー全カバー

---

## Running the App

### 開発サーバー起動

```bash
npm run dev
```

アプリにアクセス: http://localhost:5173/time-tracker

### 動作確認手順

#### P1: デバイス間同期

1. ブラウザAでセッション開始
2. ブラウザB（シークレットモード）で同じアカウントでログイン
3. ブラウザBでリロード → 同じセッションが表示されることを確認
4. ブラウザAでタイトル変更
5. ブラウザBでリロード → 変更が反映されることを確認

#### P2: Google Sheets同期

1. Google Sheets連携を設定
2. セッション開始 → Sheetsに新しい行が追加される
3. タイトル変更 → Sheetsの該当行が更新される（1秒後）
4. セッション停止 → status="Completed"に変更される

---

## Debugging

### Supabase同期のデバッグ

```bash
# ブラウザのコンソールでログ確認
# app/src/features/time-tracker/hooks/data/useRunningSession.ts の
# console.warn() が出力されているか確認
```

Supabase Studioでデータ確認:
```sql
SELECT * FROM time_tracker_running_states WHERE user_id = 'your-user-id';
```

### Google Sheets同期のデバッグ

ブラウザのNetwork タブでAPIリクエスト確認:
- `https://sheets.googleapis.com/v4/spreadsheets/.../values:append`
- `https://sheets.googleapis.com/v4/spreadsheets/.../values:batchUpdate`

エラーログ確認:
```javascript
// app/src/infra/google/googleSheetsRunningSync.ts に以下を追加
console.log('[Google Sheets] Append request:', { draft, options });
```

---

## Common Issues

### Issue 1: Supabase同期が動作しない

**症状**: デバイスBでリロードしても同期されない

**原因**:
- `VITE_SUPABASE_URL` または `VITE_SUPABASE_ANON_KEY` が未設定
- RLSポリシーが正しく設定されていない
- userIdが渡されていない

**解決策**:
```bash
# 環境変数確認
echo $VITE_SUPABASE_URL

# RLSポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'time_tracker_running_states';
```

### Issue 2: Google Sheets APIエラー

**症状**: `403 Forbidden` エラー

**原因**:
- Google Cloud PlatformでSheets APIが有効化されていない
- OAuth 2.0認証が失敗している

**解決策**:
```bash
# GCP Console → APIs & Services → Enabled APIs
# "Google Sheets API" が有効か確認

# OAuth 2.0クライアントIDの設定確認
# Authorized JavaScript origins: http://localhost:5173
```

### Issue 3: E2Eテストが失敗する

**症状**: `expect(locator).toBeVisible()` でタイムアウト

**原因**:
- Supabaseモックが正しく設定されていない
- テストの待機時間が不足

**解決策**:
```typescript
// Supabaseをモック
await page.route('**/rest/v1/**', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ data: mockData }),
  });
});

// 待機時間を延長
await expect(locator).toBeVisible({ timeout: 10000 });
```

---

## Next Steps

✅ **実装完了**: Phase 1-4の実装とテストがすべて完了しました。

今後の拡張:
1. UI改善: Column Mapping設定画面への`id`/`status`列追加
2. リアルタイム更新: Supabase Realtimeによるプッシュ通知の追加
3. 競合解決: 複数デバイスからの同時編集時のマージ戦略実装

---

## Resources

- [Spec](./spec.md): 機能仕様
- [Plan](./plan.md): 実装計画
- [Data Model](./data-model.md): データモデル定義
- [Contracts](./contracts/google-sheets-api.md): APIインターフェース
- [Supabase Docs](https://supabase.com/docs)
- [Google Sheets API Docs](https://developers.google.com/sheets/api)
- [Playwright Docs](https://playwright.dev)
