---
description: "Task list for theme-based session management"
---

# Tasks: Manage Sessions by Higher-Level Theme

**Input**: Design documents from `/specs/005-manage-by-project/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are OPTIONAL - only include them if explicitly requested in the feature specification (not requested here).  
**Organization**: Tasks are grouped by user story so each story can be implemented and tested independently.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

- [ ] T001 [P] [Setup] `npm install` をリポジトリルートで実行し、依存関係を最新化する。
- [ ] T002 [P] [Setup] `app/.env.example` を `app/.env.local` にコピーし、Supabase と Google Sheets 同期用の環境変数を設定しておく。

---

## Phase 2: Foundational (Blocking Prerequisites)

- [ ] T003 [FOUND] Supabase 変更用に `supabase/migrations/<timestamp>_add_themes.sql` を作成し、`time_tracker_themes` テーブル（owner_id, status, updated_at 付き）と `time_tracker_projects` / `time_tracker_sessions` の新カラム（theme_id, project_id, classification_path, status, updated_at）を定義、既存データにデフォルトテーマ「経営者鍛錬」を紐付ける。
- [ ] T004 [FOUND] `app/src/infra/localstorage/timeTrackerStorage.ts` にテーマ対応マイグレーションを追加し、変換ロジックを `app/src/infra/localstorage/migrations/applyThemeUpgrade.ts` として実装・呼び出す。
- [x] T005 [FOUND] `app/src/features/time-tracker/domain/types.ts` と `app/src/infra/repository/TimeTracker/types.ts` を更新して `ownerId` / `themeId` / `classificationPath` を含む新しいドメイン型・リポジトリ型を定義する。

---

## Phase 3: User Story 1 - 上位テーマでセッションを整理する (Priority: P1) 🎯 MVP

**Goal**: テーマ > プロジェクトの 2 階層でセッションを分類・表示できるようにする。  
**Independent Test**: テーマを作成し、プロジェクトを紐付けた状態でセッションを開始・終了すると、履歴画面で「テーマ > プロジェクト」構造が確認できる。

### Implementation for User Story 1

- [x] T006 [US1] `app/src/features/time-tracker/domain/runningSession.ts` と `hooks/data/useRunningSessionState.ts` / `useRunningSessionSync.ts` を拡張し、テーマ選択・保持（start, stop, hydrate, draft 更新）を扱えるようにする。
- [x] T007 [US1] `app/src/infra/repository/TimeTracker/localStorageDataSource.ts` と `supabaseDataSource.ts` を更新し、Theme/Project の ownerId と classificationPath を読み書きできるようにする。
- [x] T008 [US1] `app/src/infra/repository/TimeTracker` にテーマ CRUD 用のリポジトリ関数を追加し、それを利用する `app/src/features/time-tracker/hooks/data/useThemes.ts`（新規）を実装して TanStack Query で一覧・作成・更新・アーカイブを扱えるようにする。
- [ ] T009 [US1] `app/src/features/time-tracker/components/ThemeManager/ThemeManager.tsx`（新規）を作成し、テーマの追加・名称変更・アーカイブ UI を実装して `index.ts` からエクスポートする。
- [ ] T010 [US1] `app/src/features/time-tracker/components/Composer/Composer.tsx` を改修し、テーマ選択ポップオーバーとプロジェクト選択を統合、テーマ未選択時の動作とフォーカス制御を再実装する。
- [ ] T011 [US1] `app/src/features/time-tracker/pages/TimeTracker/TimeTrackerPage.tsx` と `logic.ts` を更新し、取得したセッションをテーマ > プロジェクトのツリーで表示・フィルタできるようにする。
- [ ] T012 [P] [US1] `app/src/features/time-tracker/domain/googleSyncTypes.ts` と `app/src/infra/google/googleSyncClient.ts` を更新し、Google スプレッドシート同期に Theme 列を追加する。

**Checkpoint (US1)**: テーマの CRUD、セッション開始/終了、履歴表示、Google Sheets 同期が全てテーマ対応で動作する。

---

## Phase 4: User Story 2 - 将来の階層拡張余地を検討する (Priority: P2)

**Goal**: 追加階層を導入しても破壊的変更を最小化できる下準備を整える。  
**Independent Test**: 分類階層を 3 層に拡張する際の手順を資料ベースで説明でき、コード上も classificationPath を拡張可能な構造になっている。

### Implementation for User Story 2

- [ ] T013 [US2] `app/src/features/time-tracker/domain/classificationPath.ts`（新規）を追加し、階層 ID 配列の生成・マージ・拡張を行うユーティリティ関数と型を定義、既存コードでの分類計算に組み込む。
- [ ] T014 [P] [US2] `docs/adr/app/20251103-theme-hierarchy.md`（新規）を作成し、階層追加時のステップ（データモデル・UI・同期処理の更新手順）を整理する。
- [ ] T015 [P] [US2] `specs/005-manage-by-project/data-model.md` と `specs/005-manage-by-project/research.md` を追記し、classificationPath を拡張する際のバージョニングポリシーとサンプルワークフローを明文化する。

**Checkpoint (US2)**: classificationPath ユーティリティとドキュメントにより、追加階層の導入手順が確立される。

---

## Phase 5: User Story 3 - 用語の整合性を保つ (Priority: P3)

**Goal**: テーマ／プロジェクト命名の方針をコード・ドキュメント全体で整合させる。  
**Independent Test**: ガイドラインに記載された語彙通りに UI/ドキュメントが更新されていることをレビューで確認できる。

### Implementation for User Story 3

- [ ] T016 [US3] `app/IMPLEMENTS.md` を更新し、テーマとプロジェクトの命名規則・UI 表記・翻訳ポリシーを記載する。
- [ ] T017 [US3] `docs` 配下に `docs/naming/theme-and-project.md`（新規）を作成し、コード上で使用する型名・ファイル名・翻訳キーのガイドをまとめ、関連ドキュメントから参照リンクを追加する。

**Checkpoint (US3)**: チーム内で共有する命名ガイドが整備され、UI/コード/ドキュメントの表記ゆれが解消される。

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T018 [Polish] `npm run lint` と `npm run test:unit` を実行し、テーマ対応コードのビルド/テストが通ることを確認して結果を共有する。
- [ ] T019 [Polish] `specs/005-manage-by-project/quickstart.md` と `docs/deploy.md` を更新し、ローカル/本番でのマイグレーション適用手順と Google Sheets 同期確認手順を反映する。

---

## Dependencies & Execution Order

- Setup → Foundational → US1 → US2 → US3 → Polish  
- US1 は Foundational 完了後に開始。US2 は US1 完了後に着手、US3 は US2 の結果に依存しないため US2 と並列可。Polish は全ストーリー完了後に実施する。

## Parallel Execution Examples

- US1: `T012`（Google Sheets 同期対応）は UI 改修（T010〜T011）と並行して実装可能。  
- US2: ドキュメント整備（T014, T015）はユーティリティ実装（T013）と並行して進められる。  
- Setup: `T001`, `T002` は同時に進めても問題ない。

## Implementation Strategy

1. **MVP First (US1)**: データ移行とテーマ UI/同期対応で、テーマ分類の実働を最優先して提供する。  
2. **Future-proofing (US2)**: classificationPath のユーティリティ化とドキュメント整備で将来拡張のコストを下げる。  
3. **Documentation Consistency (US3)**: 命名ガイドを整備し、以降の実装での表記ぶれを防止する。  
4. **Final Polish**: lint/test 実行とドキュメント更新でリリース準備を完了する。
