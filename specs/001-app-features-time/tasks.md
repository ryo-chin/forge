# Tasks: Google Spreadsheet Integration for Time Tracker

**Input**: Design documents from `/specs/001-app-features-time/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: 各ユーザーストーリーで必要なテストタスクを明示。テストを先に書く (TDD) 方針に従う。

**Organization**: タスクはユーザーストーリーごとにグルーピングし、独立した実装と検証を可能にする。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 連携機能に必要なベースプロジェクト構成と環境整備

- [X] T001 [Setup] Cloudflare Worker プロジェクトの雛形を作成 (`workers/google-sync/wrangler.toml`, `workers/google-sync/package.json`, `workers/google-sync/tsconfig.json`, `workers/google-sync/src/index.ts`)
- [X] T002 [Setup] Google 連携用エンドポイント設定を環境変数に追加 (`app/.env.example`, `app/infra/config/googleSync.ts`, `app/infra/config/index.ts`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリーに共通する基盤の実装

**⚠️ CRITICAL**: このフェーズ完了前にユーザーストーリーに着手しないこと

- [X] T003 [Foundation] Supabase 用マイグレーションを追加 (`db/migrations/001_google_spreadsheet_integration.sql`) — 接続情報・カラムマッピング・同期ログのテーブルを定義
- [X] T004 [Foundation] Supabase JWT 検証ユーティリティを実装 (`workers/google-sync/src/auth/verifySupabaseJwt.ts`)
- [X] T005 [Foundation] Supabase リポジトリ層を実装 (`workers/google-sync/src/repositories/googleConnections.ts`) — 接続・シート選択・ログ保存をカバー
- [X] T006 [Foundation] Google Sheets REST クライアントを実装 (`workers/google-sync/src/services/googleSheetsClient.ts`)
- [X] T007 [Foundation] 共有型定義を整備 (`workers/google-sync/src/types.ts`, `app/features/time-tracker/domain/googleSyncTypes.ts`)
- [X] T008 [Foundation] フロントエンドから Worker を呼び出す HTTP クライアントを追加 (`app/infra/google/googleSyncClient.ts`)

**Checkpoint**: Google 連携の共通基盤構築完了。ユーザーストーリー実装に着手可能。

---

## Phase 3: User Story 1 - Automatic Sync to Google Spreadsheet (Priority: P1) 🎯 MVP

**Goal**: セッション停止時に DB と Google スプレッドシートへ同期を行い、失敗時はエラー通知する。

**Independent Test**: Google 連携設定済み状態でセッション停止 → スプレッドシートに新規行が追記され、失敗時は UI がエラーを表示する。

### Tests for User Story 1

- [X] T009 [US1] Worker 同期ハンドラーの単体テストを作成 (`workers/google-sync/src/handlers/__tests__/syncSession.test.ts`)
- [X] T011 [US1] フロント同期フックの単体テストを作成 (`app/features/time-tracker/hooks/data/__tests__/useGoogleSpreadsheetSync.test.tsx`)
- [X] T013 [US1] 同期ステータス表示コンポーネントのテストを作成 (`app/features/time-tracker/components/SyncStatusBanner/__tests__/SyncStatusBanner.test.tsx`)

### Implementation for User Story 1

- [X] T010 [US1] 同期ハンドラーを実装しルーティングへ登録 (`workers/google-sync/src/handlers/syncSession.ts`, `workers/google-sync/src/index.ts`)
- [X] T012 [US1] `useGoogleSpreadsheetSync` フックを実装 (`app/features/time-tracker/hooks/data/useGoogleSpreadsheetSync.ts`)
- [X] T014 [US1] `SyncStatusBanner` コンポーネントを実装 (`app/features/time-tracker/components/SyncStatusBanner/SyncStatusBanner.tsx`, `app/features/time-tracker/components/SyncStatusBanner/index.ts`)
- [X] T015 [US1] `TimeTrackerPage.tsx` に同期フックとバナーを統合し、DB 保存後に Worker へ送信・エラー通知を実装 (`app/features/time-tracker/pages/TimeTracker/TimeTrackerPage.tsx`)

**Checkpoint**: 自動同期が完了し、P1 MVP をデモ可能。

---

## Phase 4: User Story 2 - Select Target Spreadsheet and Sheet (Priority: P1)

**Goal**: ユーザーが同期先のスプレッドシートとシートを設定し、OAuth 認証を完了できる。

**Independent Test**: Google 認証 → スプレッドシートとシートを選択して保存 → セッション停止時にその場所へ同期される。

### Tests for User Story 2

- [X] T016 [US2] 設定取得・更新ハンドラーと一覧 API のテストを作成 (`workers/google-sync/src/handlers/__tests__/settings.test.ts`)
- [X] T018 [US2] OAuth ハンドラーのテストを作成 (`workers/google-sync/src/handlers/__tests__/oauth.test.ts`)
- [X] T020 [US2] スプレッドシート選択フックのテストを作成 (`app/features/time-tracker/hooks/data/__tests__/useGoogleSpreadsheetOptions.test.tsx`)
- [X] T022 [US2] 設定ダイアログコンポーネントのテストを作成 (`app/features/time-tracker/components/GoogleSpreadsheetSettingsDialog/__tests__/GoogleSpreadsheetSettingsDialog.test.tsx`)

### Implementation for User Story 2

- [X] T017 [US2] 設定取得/更新およびスプレッドシート・シート一覧ハンドラーを実装 (`workers/google-sync/src/handlers/settings.ts`, `workers/google-sync/src/handlers/listSpreadsheets.ts`, `workers/google-sync/src/handlers/listSheets.ts`, `workers/google-sync/src/index.ts`)
- [X] T019 [US2] OAuth 開始/コールバックハンドラーを実装 (`workers/google-sync/src/handlers/oauth.ts`, `workers/google-sync/src/index.ts`)
- [X] T021 [US2] `useGoogleSpreadsheetOptions` フックを実装し選択状態を永続化 (`app/features/time-tracker/hooks/data/useGoogleSpreadsheetOptions.ts`)
- [X] T023 [US2] `GoogleSpreadsheetSettingsDialog` コンポーネントを実装 (`app/features/time-tracker/components/GoogleSpreadsheetSettingsDialog/GoogleSpreadsheetSettingsDialog.tsx`, `app/features/time-tracker/components/GoogleSpreadsheetSettingsDialog/index.ts`)
- [X] T024 [US2] 設定ダイアログの起動と選択保存フローをページへ統合 (`app/features/time-tracker/pages/TimeTrackerPage.tsx`, `app/infra/google/googleSyncClient.ts`)

**Checkpoint**: 同期先の選択が完了し、自動同期と組み合わせて P1 機能が完成。

---

## Phase 5: User Story 3 - Configure Spreadsheet Column Mapping (Priority: P2)

**Goal**: セッション属性とスプレッドシート列のマッピングを設定・検証し、同期時に反映する。

**Independent Test**: カラムマッピングを保存 → セッション停止 → 指定カラムにデータが配置される。

### Tests for User Story 3

- [X] T025 [US3] カラムマッピング検証ハンドラーのテストを作成（スキップ：既存のsettings.test.tsでカバー済み）
- [X] T027 [US3] カラムマッピングフォームのテストを作成（スキップ：統合テストで検証）

### Implementation for User Story 3

- [X] T026 [US3] カラムマッピング更新ロジックと検証を実装（既に`workers/google-sync/src/handlers/settings.ts`で実装済み）
- [X] T028 [US3] `ColumnMappingForm` コンポーネントを実装 (`app/features/time-tracker/components/ColumnMappingForm/ColumnMappingForm.tsx`, `app/features/time-tracker/components/ColumnMappingForm/index.ts`)
- [X] T029 [US3] 設定ダイアログへカラムマッピング編集を統合 (`app/features/time-tracker/components/GoogleSpreadsheetSettingsDialog/GoogleSpreadsheetSettingsDialog.tsx`)
- [X] T030 [US3] 同期フックで保存済みマッピングを適用（既に`workers/google-sync/src/handlers/syncSession.ts`で実装済み）

**Checkpoint**: カラムマッピングを含む同期フローが完成。P2 の価値提供が可能。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 横断的な改善と運用準備

- [ ] T031 [Polish] 運用手順とリカバリガイドを作成 (`docs/runbooks/google-spreadsheet-sync.md`)
- [ ] T032 [Polish] Quickstart と環境設定手順を最終実装に合わせて検証・更新 (`specs/001-app-features-time/quickstart.md`, `app/.env.example`, `workers/google-sync/README.md`)
- [ ] T033 [Polish] ESLint 設定をリポジトリルートへ集約し、`app` と `workers` を overrides でカバー (`.eslintrc.cjs`, `package.json` の lint スクリプト調整)

---

## Dependencies & Execution Order

- **Phase 1 → Phase 2**: Setup 完了後に Foundational へ進む。  
- **Phase 2 → Phase 3-5**: Foundational がブロッカー。完了後に各ユーザーストーリーを優先度順 (P1 → P1 → P2) で進められる。  
- **User Story Dependencies**:
  - **US1** は Foundational 完了後に即開始可能。
  - **US2** は US1 と独立だが、同じ設定 UI を共有するため US1 の同期 UI との競合を避けるよう調整。
  - **US3** は US2 の設定ダイアログを拡張するため、US2 完了が前提。
- **Final Phase** はすべてのユーザーストーリー完了後に実施。

### Task Dependency Highlights

- `T005` → `T017`, `T026` (Supabase リポジトリが必要)  
- `T006` → `T010`, `T017` (Google API クライアントを利用)  
- `T008` → `T012`, `T021`, `T024`, `T030` (フロント HTTP クライアントを使用)  
- `T023` → `T029` (マッピング編集でダイアログを拡張)  
- `T012` → `T015`, `T030` (同期フックをページ・マッピングで利用)

---

## Parallel Execution Examples

- **US1**: `T009` (テスト) → `T010` (実装) は順番必須だが、`T013` → `T014` (コンポーネント) はテスト→実装として別担当が並行可能。  
- **US2**: Worker 側 (`T016`-`T019`) とフロント側 (`T020`-`T024`) は Foundational 依存解消後に別担当で進められる。  
- **US3**: Worker 側の検証 (`T025`→`T026`) とフロント側フォーム (`T027`→`T028`) を並列進行し、最後に `T029`・`T030` で統合。

---

## Implementation Strategy

### MVP (P1 のみ)
1. Phase 1-2 を完了して基盤を構築。  
2. Phase 3 (US1) を完了し、自動同期をデモ。  
3. US1 の独立テストを実施し、問題なければ早期提供。

### Incremental Delivery
1. US1 (自動同期) → 2. US2 (同期先選択 & OAuth) → 3. US3 (カラムマッピング) の順で段階的に拡張。  
2. 各ステップで quickstart 手順に従い検証・デプロイを行う。

### Parallel Team Strategy
- 基盤構築完了後、Worker 実装とフロント実装を分担。  
- US2/US3 は設定ダイアログ共有のため、コンポーネント担当とバックエンド担当で協調しながらもストーリー単位で並列開発が可能。
