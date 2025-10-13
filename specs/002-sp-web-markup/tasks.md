---
description: "Task list template for feature implementation"
---

# Tasks: TimeTrackerPage モバイル最適化

**Input**: Design documents from `/specs/002-sp-web-markup/`  
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: この機能では P1〜P4 のユーザーストーリーをそれぞれ独立に検証するため、各ストーリーの検証ポイントを quickstart.md に従い実施する。テストタスクは任意であり、実装タスク内で TDD フローを確保する。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions
- **Forge frontend**: `app/src/` 配下に実装（機能モジュールは `app/src/features/<feature>`）
- **共有テスト**: コンポーネント/ドメインは実装ファイル横に `.test.ts[x]` を配置
- **E2E テスト**: `app/tests/e2e/`
- 他プロジェクト構成の場合は plan.md の構造に合わせてパスを調整すること

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 既存フロントエンド環境の再確認とモバイル検証の基盤整備

- [ ] T001 [P] Install dependencies for frontend (`npm install`) 並びに Playwright モバイルプロジェクトの確認
- [ ] T002 [P] `app/src/features/time-tracker/index.css` の現状スタイルをレビューしモバイル対応に必要な共通トークンを洗い出す
- [ ] T003 [P] Playwright の `Mobile Chrome` プロジェクト設定を quickstart に従い実行確認

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのユーザーストーリーに共通する基盤の整備

- [ ] T004 定義済み `HamburgerMenuState`/`ResponsiveLayoutState` を扱うための UI state hook ひな形を `app/src/features/time-tracker/pages/TimeTracker/hooks.ts` に用意
- [ ] T005 `app/src/features/time-tracker/index.css` にモバイル用ブレークポイント変数・共通ユーティリティクラス（タップ領域 44px、safe-area padding）を追加
- [ ] T006 TimeTrackerPage の layout コンテナへ viewport クラスを付与する仕組みを `app/src/features/time-tracker/pages/TimeTracker/TimeTrackerPage.tsx` に導入（まだスタイル適用は最小限）

**Checkpoint**: Responsive state と共通スタイルの基盤が整い、ユーザーストーリー実装が開始できる状態

---

## Phase 3: User Story 1 - モバイルでタイマーを開始・停止できる (Priority: P1) 🎯 MVP

**Goal**: モバイルファーストビューで開始/停止ボタンをタップ可能にし、横スクロールを排除する

**Independent Test**: スマホエミュレーターでページ表示 → スクロール無しで開始→停止まで操作可能なことを確認

### Implementation for User Story 1

- [ ] T007 [P][US1] `TimeTrackerPage` のメインレイアウトを縦積みに変更（`app/src/features/time-tracker/pages/TimeTracker/TimeTrackerPage.tsx`）
- [ ] T008 [P][US1] コンポーザーとタイマーブロックの CSS をモバイル向けに再構成（`app/src/features/time-tracker/index.css`）
- [ ] T009 [US1] タイマー操作ボタンのタップ領域/フォントサイズ調整（`app/src/features/time-tracker/components/Composer/Composer.tsx` と CSS）
- [ ] T010 [US1] 開始/停止後のフォーカスリセットやスクロール防止確認のテストシナリオを Playwright に追加（`app/tests/e2e/time-tracker-mobile.spec.ts`）

**Checkpoint**: タイマー操作がモバイルで MVP として成立

---

## Phase 4: User Story 2 - モバイルでグローバルメニューにアクセスできる (Priority: P2)

**Goal**: ハンバーガーアイコンで既存メニューを展開し、背面操作をブロックする

**Independent Test**: モバイル表示でアイコンタップ → メニュー展開 → 項目選択で閉じる、背面スクロール無しを確認

### Implementation for User Story 2

- [ ] T011 [P][US2] ハンバーガーアイコンコンポーネントを `TimeTrackerPage` ヘッダーへ追加（`app/src/features/time-tracker/pages/TimeTracker/TimeTrackerPage.tsx`）
- [ ] T012 [P][US2] メニュー展開用オーバーレイとアニメーション CSS を追加（`app/src/features/time-tracker/index.css`）
- [ ] T013 [US2] `isMenuOpen` state と body overflow 制御ロジックを `TimeTrackerPage.tsx` に実装
- [ ] T014 [US2] メニュー内リンクをクリックで自動閉幕する処理を `app/src/ui` のナビゲーションコンポーネントに追加
- [ ] T015 [US2] Playwright でハンバーガー開閉・選択シナリオを追加（`app/tests/e2e/time-tracker-mobile.spec.ts`）

**Checkpoint**: メニュー操作がモバイルで独立検証可能

---

## Phase 5: User Story 3 - 進行中セッションをスマホで調整できる (Priority: P3)

**Goal**: 進行中セッション情報がモバイルで読みやすく編集できる

**Independent Test**: モバイル表示で進行中セッションの編集シートを開き、タイトル/プロジェクト編集後に保存できることを確認

### Implementation for User Story 3

- [ ] T016 [P][US3] 進行中セッション情報の表示領域をモバイル向けに調整（`app/src/features/time-tracker/pages/TimeTracker/TimeTrackerPage.tsx`）
- [ ] T017 [P][US3] `EditorModal` をモバイル全画面/シート表示へスタイル拡張（`app/src/features/time-tracker/components/EditorModal/EditorModal.tsx` および CSS）
- [ ] T018 [US3] モーダル内入力のタップ領域・ボタンサイズを調整（`app/src/features/time-tracker/components/EditorModal/EditorModal.tsx`）
- [ ] T019 [US3] 進行中セッション編集フローの E2E シナリオを追加（`app/tests/e2e/time-tracker-mobile.spec.ts`）

**Checkpoint**: 進行中セッション編集がモバイルで完結可能

---

## Phase 6: User Story 4 - 履歴をスマホで確認・編集できる (Priority: P4)

**Goal**: 履歴一覧の確認・編集・削除・元に戻すフローをモバイルで操作可能にする

**Independent Test**: 履歴から任意セッションを編集・削除・元に戻すまでモバイルで完遂

### Implementation for User Story 4

- [ ] T020 [P][US4] 履歴一覧を 1 カラムカード表示へ変更（`app/src/features/time-tracker/components/HistoryList/HistoryList.tsx`）
- [ ] T021 [P][US4] 履歴カードのタップ領域・情報サマリのレイアウト調整（CSS）
- [ ] T022 [US4] 履歴詳細モーダルのモバイル表示最適化（`EditorModal`/履歴専用ロジック）
- [ ] T023 [US4] 削除→元に戻す UI の位置とタップ導線調整（`HistoryList` CSS）
- [ ] T024 [US4] Playwright で履歴編集・削除・元に戻すシナリオを追加（`app/tests/e2e/time-tracker-mobile.spec.ts`）

**Checkpoint**: 履歴操作がモバイルで独立完了可能

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリー横断での仕上げ

- [ ] T025 [P] 共通アクセシビリティ検証（フォーカスリング、スクリーンリーダーラベル）
- [ ] T026 [P] スナップショットテスト/ビジュアルチェック（Loki 等があれば実行）
- [ ] T027 ドキュメント更新（`app/README.md` のモバイル検証手順追記）
- [ ] T028 `quickstart.md` の検証チェックリストを反映しセルフ QA 実施

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: すぐ着手可能
- **Foundational (Phase 2)**: Setup 完了後に着手、すべてのユーザーストーリーの前提
- **User Stories (Phase 3〜6)**: Foundational 完了後、優先度順に実施（P1 → P2 → P3 → P4）
- **Polish (Phase 7)**: 全ユーザーストーリー完了後

### User Story Dependencies

- **US1 (P1)**: Foundational 完了後に開始。MVP。
- **US2 (P2)**: US1 と独立して進められるが、メニュー内のタイマー状態表示を確認するため US1 の UI を参照。
- **US3 (P3)**: US1 のタイマー配置が前提。
- **US4 (P4)**: 履歴表示は US1〜US3 と独立するが、モーダルスタイルは US3 の成果を再利用。

### Parallel Opportunities

- Phase 1 と Phase 2 内の [P] タスクは並列実行可。
- 各ユーザーストーリー内で [P] 表記のあるタスクは別ファイルのため並列可。

---

## Parallel Execution Examples

### User Story 1
- 同時進行可能: T007 (レイアウト JSX) と T008 (CSS 調整)
- T009 (ボタン調整) は T007/008 完了後に実施
- T010 E2E は実装後に記録

### User Story 2
- T011 (アイコン追加) と T012 (CSS) は並行
- T013 (state 管理) は前二つを参照
- T014, T015 は状態実装後

### User Story 3
- T016 と T017 は別コンポーネント編集で並列可能
- T018 はモーダル調整後、T019 テストは最後

### User Story 4
- T020 と T021 を並行実施
- T022/T023 はカード調整後に進め、最後に T024 テスト

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Setup → Foundational → US1
2. モバイル版タイマー操作が完了した時点で最小価値提供可能

### Incremental Delivery
1. US1 で MVP
2. US2 追加でナビゲーションをモバイル対応
3. US3 で進行中管理、US4 で履歴管理まで拡張

### Parallel Team Strategy
1. Phase 1/2 をチームで完了
2. US1〜US4 を担当者別に分担（優先度順だが準備が整えば並行も可）
3. Polish で仕上げ
