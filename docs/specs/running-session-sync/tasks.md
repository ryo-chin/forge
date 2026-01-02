# Tasks: Running Session同期機能

**Input**: Design documents from `/specs/004-running-session-running/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/google-sheets-api.md

**Tests**: TDD (Test-Driven Development) アプローチを採用。すべてのテストを実装前に作成し、Red-Green-Refactorサイクルを厳守。

**Organization**: タスクはユーザーストーリー別に編成し、各ストーリーを独立して実装・テスト・デプロイ可能にする。

## Format: `[ID] [P?] [Story] Description`
- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: このタスクが属するユーザーストーリー（US1, US2）
- 説明に正確なファイルパスを含める

## Path Conventions
- **機能実装**: `app/src/features/time-tracker/` 配下
- **Infraレイヤー**: `app/src/infra/` 配下
- **ユニット/コンポーネントテスト**: 実装ファイルと同階層に `*.test.ts[x]`
- **E2Eテスト**: `app/tests/e2e/`

---

## Phase 1: Setup (共有インフラストラクチャ)

**目的**: プロジェクト初期化と基本構造の確認

- [ ] T001 [P] 開発環境のセットアップを確認（quickstart.md参照）
- [ ] T002 [P] 既存のSupabaseテーブル `time_tracker_running_states` の動作確認
- [ ] T003 [P] 既存のGoogle Sheets API設定の動作確認

---

## Phase 2: Foundational (ブロッキング前提条件)

**目的**: すべてのユーザーストーリーで必要な基盤コード

**⚠️ CRITICAL**: このフェーズが完了するまで、ユーザーストーリーの作業は開始できません

- [ ] T004 [P] `SessionDraft`型に`tempId?: string`フィールドを追加（app/src/features/time-tracker/domain/types.ts）
- [ ] T005 [P] `GoogleSpreadsheetOptions`型に`statusColumn?: string`, `tempIdColumn?: string`を追加（app/src/features/time-tracker/domain/googleSyncTypes.ts）

**Checkpoint**: 基盤準備完了 - ユーザーストーリーの実装を並列開始可能

---

## Phase 3: User Story 1 - デバイス間でRunning中セッションを引き継ぐ (Priority: P1) 🎯 MVP

**Goal**: Supabaseを使って複数デバイス間でRunning中のセッション状態を同期し、デバイスを切り替えても作業を中断せずに継続できるようにする

**Independent Test**: デバイスAでセッション開始→デバイスBでアプリをリロード→同じセッションが表示され、経過時間が正しく引き継がれる

### Tests for User Story 1 (TDD: Red → Green → Refactor)

**NOTE: これらのテストを最初に作成し、FAILすることを確認してから実装に進む**

- [ ] T006 [P] [US1] `useRunningSession`のSupabase同期テストを作成（app/src/features/time-tracker/hooks/data/__tests__/useRunningSession.sync.test.tsx）
  - マウント時にサーバーからRunning状態を取得するテスト
  - セッション開始時にサーバーに永続化するテスト
  - セッション編集時にサーバーに同期するテスト
  - 他デバイスの変更をリロード時に取得するテスト

- [ ] T007 [P] [US1] Supabaseデータソースのユニットテストを作成（app/src/infra/repository/TimeTracker/__tests__/supabaseDataSource.test.ts）
  - `fetchRunningState()`のテスト
  - `persistRunningState()`のテスト
  - エラーハンドリングのテスト

- [ ] T008 [US1] 複数デバイス同期のE2Eテストを作成（app/tests/e2e/running-session-sync.spec.ts）
  - シナリオ1: デバイスAでセッション開始→デバイスBで表示確認
  - シナリオ2: デバイスAでタイトル変更→デバイスBで反映確認
  - シナリオ3: デバイスAでプロジェクト設定→デバイスBで反映確認
  - シナリオ4: デバイスBでセッション停止→デバイスAで停止済み確認

### Implementation for User Story 1

**注: 既存実装の検証が主タスク。Supabase同期は既に実装済みのため、テストを追加して動作確認のみ**

- [ ] T009 [US1] テストを実行し、既存のSupabase同期実装が正しく動作することを確認
  - `useRunningSession`のマウント時fetch
  - 状態変更時のpersist
  - シグネチャベースの差分検出

- [ ] T010 [US1] 必要に応じて既存実装を微調整（エラーハンドリング、ログ追加など）

- [ ] T011 [US1] E2Eテストを実行し、複数デバイスシミュレーションを検証

- [ ] T012 [US1] `app/IMPLEMENTS.md`にP1（デバイス間同期）の説明を追加

**Checkpoint**: この時点で、User Story 1は完全に機能し、独立してテスト可能

---

## Phase 4: User Story 2 - Google Sheetsへのリアルタイム同期 (Priority: P2)

**Goal**: Google Sheets連携を有効にしているユーザーが、Running中のセッション情報をスプレッドシート上でリアルタイムに確認できるようにする

**Independent Test**: Google Sheets連携を設定→セッション開始→シート上に「Running」状態の行が追加→編集時に更新→停止時に「Completed」に変更

### Tests for User Story 2 (TDD: Red → Green → Refactor)

- [ ] T013 [P] [US2] `googleSyncClient`のRunning同期テストを作成（app/src/infra/google/__tests__/googleSyncClient.running.test.ts）
  - `appendRunningSession()`のテスト（新しい行追加、status="Running"）
  - `updateRunningSession()`のテスト（タイトル、プロジェクト、タグ等の更新）
  - `completeRunningSession()`のテスト（status="Completed"への変更）
  - エラーハンドリングのテスト（行が見つからない、API失敗）

- [ ] T014 [P] [US2] `useGoogleSpreadsheetSync`のRunning同期テストを作成（app/src/features/time-tracker/hooks/data/__tests__/useGoogleSpreadsheetSync.running.test.tsx）
  - セッション開始時に`appendRunningSession()`が呼ばれるテスト
  - セッション編集時に`updateRunningSession()`が呼ばれるテスト（debounce適用）
  - セッション停止時に`completeRunningSession()`が呼ばれるテスト
  - リロード時に経過時間が更新されるテスト

- [ ] T015 [US2] Google Sheets同期のE2Eテストを作成（app/tests/e2e/google-sheets-sync.spec.ts）
  - シナリオ1: セッション開始→Sheets APIモックで行追加確認
  - シナリオ2: タイトル変更→Sheets APIモックで行更新確認
  - シナリオ3: セッション停止→Sheets APIモックでstatus="Completed"確認
  - シナリオ4: Google Sheets連携エラー時もアプリが正常動作することを確認

### Implementation for User Story 2

- [ ] T016 [P] [US2] `tempId`生成ロジックを`useRunningSession`に追加（app/src/features/time-tracker/hooks/data/useRunningSession.ts）
  - セッション開始時に`crypto.randomUUID()`で`tempId`を生成
  - `SessionDraft`の`tempId`フィールドに設定

- [ ] T017 [US2] `googleSyncClient`に`appendRunningSession()`メソッドを実装（app/src/infra/google/googleSyncClient.ts）
  - `spreadsheets.values.append` APIを使用
  - status="Running", tempId, タイトル、開始時刻等を設定
  - endedAt、durationSecondsは空にする

- [ ] T018 [US2] `googleSyncClient`に`updateRunningSession()`メソッドを実装（app/src/infra/google/googleSyncClient.ts）
  - tempIdでRunning行を検索
  - `spreadsheets.values.batchUpdate` APIで該当行を更新
  - タイトル、プロジェクト、タグ、スキル、強度、メモ、経過時間を更新

- [ ] T019 [US2] `googleSyncClient`に`completeRunningSession()`メソッドを実装（app/src/infra/google/googleSyncClient.ts）
  - tempIdでRunning行を検索
  - status="Completed"に変更
  - endedAt、durationSecondsを確定

- [ ] T020 [US2] `useGoogleSpreadsheetSync`にRunning同期ロジックを追加（app/src/features/time-tracker/hooks/data/useGoogleSpreadsheetSync.ts）
  - セッション開始時: `appendRunningSession()`を呼び出し
  - セッション編集時: debounce（1秒）後に`updateRunningSession()`を呼び出し
  - セッション停止時: `completeRunningSession()`を呼び出し
  - リロード時: 経過時間を更新

- [ ] T021 [US2] `ColumnMappingForm`に`statusColumn`と`tempIdColumn`の設定UIを追加（app/src/features/time-tracker/components/ColumnMappingForm/ColumnMappingForm.tsx）
  - StatusColumn入力フィールド追加
  - TempIdColumn入力フィールド追加（オプショナル）

- [ ] T022 [US2] テストを実行し、すべてがGreenになることを確認

- [ ] T023 [US2] E2Eテストを実行し、Google Sheets同期を検証

- [ ] T024 [US2] `app/IMPLEMENTS.md`にP2（Google Sheets同期）の説明を追加

**Checkpoint**: すべてのユーザーストーリーが独立して機能

---

## Phase 5: Polish & Cross-Cutting Concerns

**目的**: 複数のユーザーストーリーに影響する改善

- [ ] T025 [P] コードクリーンアップとリファクタリング
  - 重複コードの削除
  - 型定義の整理
  - コメントの追加

- [ ] T026 [P] エラーハンドリングの統一
  - ネットワークエラー時のログ出力を統一
  - ベストエフォート動作の確認

- [ ] T027 [P] パフォーマンス最適化
  - debounceの適切な設定確認
  - 不要なAPI呼び出しの削減

- [ ] T028 [P] ドキュメント更新
  - `app/IMPLEMENTS.md`の最終確認
  - 必要に応じてADR追加（Google Sheets同期パターン）

- [ ] T029 [P] quickstart.mdの検証
  - 開発環境セットアップ手順が正しいか確認
  - E2Eテストが実行できることを確認

- [ ] T030 すべてのテストがGreenになることを最終確認
  - ユニットテスト: `npm run test`
  - E2Eテスト: `npm run test:e2e`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし - すぐに開始可能
- **Foundational (Phase 2)**: Setupに依存 - すべてのユーザーストーリーをブロック
- **User Stories (Phase 3+)**: Foundationalフェーズ完了に依存
  - ユーザーストーリーは並列実行可能（人員がいる場合）
  - または優先順位順に逐次実行（P1 → P2）
- **Polish (最終フェーズ)**: すべてのユーザーストーリー完了に依存

### User Story Dependencies

- **User Story 1 (P1)**: Foundational (Phase 2) 完了後に開始可能 - 他のストーリーに依存なし
- **User Story 2 (P2)**: Foundational (Phase 2) 完了後に開始可能 - US1に依存しない（独立してテスト可能）

### Within Each User Story

- テスト作成 → テストFAIL確認 → 実装 → テストGREEN → リファクタリング（TDDサイクル）
- ドメイン・Infraレイヤー → Hooksレイヤー → UIレイヤー
- コア実装 → 統合 → E2E検証

### Parallel Opportunities

- **Setup**: T001, T002, T003は並列実行可能
- **Foundational**: T004, T005は並列実行可能
- **US1テスト**: T006, T007は並列実行可能（T008は独立）
- **US2テスト**: T013, T014は並列実行可能（T015は独立）
- **US2実装**: T016, T017, T018, T019は並列実行可能（異なるメソッド）
- **Polish**: T025, T026, T027, T028, T029は並列実行可能
- **US1とUS2**: Foundational完了後、並列実行可能（異なるチームメンバーで作業可能）

---

## Parallel Example: User Story 1

```bash
# US1のすべてのテストを一緒に開始:
Task: "useRunningSession sync test in app/src/features/time-tracker/hooks/data/__tests__/useRunningSession.sync.test.tsx"
Task: "supabaseDataSource test in app/src/infra/repository/TimeTracker/__tests__/supabaseDataSource.test.ts"

# テストFAIL確認後、検証タスクを実行:
Task: "既存のSupabase同期実装が正しく動作することを確認"
```

---

## Parallel Example: User Story 2

```bash
# US2のすべてのテストを一緒に開始:
Task: "googleSyncClient Running sync test in app/src/infra/google/__tests__/googleSyncClient.running.test.ts"
Task: "useGoogleSpreadsheetSync Running sync test in app/src/features/time-tracker/hooks/data/__tests__/useGoogleSpreadsheetSync.running.test.tsx"

# テストFAIL確認後、実装タスクを並列開始:
Task: "appendRunningSession() in app/src/infra/google/googleSyncClient.ts"
Task: "updateRunningSession() in app/src/infra/google/googleSyncClient.ts"
Task: "completeRunningSession() in app/src/infra/google/googleSyncClient.ts"
Task: "tempId generation in app/src/features/time-tracker/hooks/data/useRunningSession.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - すべてのストーリーをブロック)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: User Story 1を独立してテスト
5. 準備ができたらデプロイ/デモ

### Incremental Delivery

1. Setup + Foundational完了 → 基盤準備完了
2. User Story 1追加 → 独立してテスト → デプロイ/デモ（MVP!）
3. User Story 2追加 → 独立してテスト → デプロイ/デモ
4. 各ストーリーは、前のストーリーを壊すことなく価値を追加

### Parallel Team Strategy

複数の開発者がいる場合:

1. チーム全体でSetup + Foundationalを完了
2. Foundational完了後:
   - Developer A: User Story 1
   - Developer B: User Story 2
3. ストーリーは独立して完了し、統合

---

## Notes

- [P] タスク = 異なるファイル、依存なし、並列実行可能
- [Story] ラベル = 特定のユーザーストーリーにタスクをマッピング（トレーサビリティ）
- 各ユーザーストーリーは独立して完成・テスト可能
- **TDD厳守**: 実装前にテストを作成し、FAILすることを確認
- 各タスクまたは論理グループの後にコミット
- 各チェックポイントでストーリーを独立して検証
- 避けるべき: 曖昧なタスク、同一ファイルの競合、独立性を損なうストーリー間の依存

---

## Task Count Summary

- **Total Tasks**: 30
- **User Story 1 (P1)**: 7 tasks (T006-T012)
- **User Story 2 (P2)**: 12 tasks (T013-T024)
- **Setup**: 3 tasks (T001-T003)
- **Foundational**: 2 tasks (T004-T005)
- **Polish**: 6 tasks (T025-T030)

**Parallel Opportunities**: 18 tasks marked [P] can run in parallel

**Independent Test Criteria**:
- **US1**: デバイスAでセッション開始→デバイスBでリロード→同じセッション表示
- **US2**: Google Sheets連携設定→セッション開始→シート上にRunning行追加→停止時にCompleted

**Suggested MVP Scope**: User Story 1 (P1) のみ - デバイス間同期
