# Implementation Plan: Running Session同期機能

**Branch**: `004-running-session-running` | **Date**: 2025-10-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-running-session-running/spec.md`


## Summary

Running中のセッション状態を複数デバイス間で同期し、Google Sheetsにもリアルタイムに反映する機能を実装する。既存のSupabaseデータソース（`time_tracker_running_states` テーブル）を活用し、手動リロードベースの同期を実現する。Google Sheets APIの既存実装を拡張し、Running状態の追加・更新・完了を処理する。

## Technical Context

**Language/Version**: TypeScript 5.4+ with React 18
**Primary Dependencies**:
  - React 18
  - Supabase Client (既存)
  - Google APIs Client Library (既存)
  - Vitest + Testing Library (テスト)
  - Playwright (E2E)
**Storage**:
  - Supabase PostgreSQL (`time_tracker_running_states` テーブル - 既存)
  - LocalStorage (ローカルモード - 既存)
  - Google Sheets API (既存実装を拡張)
**Testing**: Vitest (ユニット・コンポーネント), Playwright (E2E)
**Target Platform**: Web (デスクトップ・モバイルブラウザ)
**Project Type**: Web application (Single Page Application)
**Performance Goals**:
  - デバイス切り替え時5秒以内に同期
  - Google Sheets同期10秒以内
**Constraints**:
  - Google Sheets API制限: 100リクエスト/分
  - オフライン時もローカル計測継続
  - LocalStorageモード後方互換性100%
**Scale/Scope**:
  - 小規模（単一ユーザー、複数デバイス）
  - 既存機能の拡張（新規テーブル不要）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. Feature-First Architecture ✅

すべての変更は `app/src/features/time-tracker/` 配下で完結する。既存の機能モジュール内での拡張であり、新規機能モジュールは作成しない。

- 既存hook: `useRunningSession`, `useGoogleSpreadsheetSync` を拡張
- 既存infra: `supabaseDataSource`, `googleSyncClient` を活用
- 機能間依存なし

### II. レイヤー分離とデータフロー ✅

既存のレイヤー構造を維持：
- `domain/runningSession.ts`: 既存のreducerとロジックを活用（変更なし）
- `hooks/data/useRunningSession.ts`: 同期ロジックは既に実装済み
- `hooks/data/useGoogleSpreadsheetSync.ts`: Running状態同期機能を追加
- `infra/google/googleSyncClient.ts`: Google Sheets API呼び出しを拡張

### III. Test-First Development (NON-NEGOTIABLE) ✅

TDDサイクルを厳守：
1. P1（デバイス間同期）のテスト: Supabase同期の既存実装を検証するテスト追加
2. P2（Google Sheets同期）のテスト: Running状態の追加・更新・完了のテスト追加
3. E2E: 複数デバイスシミュレーション、Google Sheets連携

### IV. Incremental Delivery & User Story Independence ✅

独立した段階的実装:
- **P1**: デバイス間同期（既存Supabase実装の検証と微調整のみ）
- **P2**: Google Sheets同期（P1に依存しない独立実装可能）

各ストーリーは個別にデプロイ・テスト可能。

### V. Simplicity & YAGNI ✅

既存パターンを活用、新規抽象化なし:
- Supabaseデータソースは既に実装済み（`time_tracker_running_states` テーブル対応済み）
- Google Sheets APIクライアントも既存
- 新規Repositoryパターン等は導入しない

### VI. Type Safety & Explicit Interfaces ✅

既存の型定義を活用:
- `RunningSessionState`, `SessionDraft` (既存)
- `GoogleSpreadsheetSyncOptions` (既存)
- `any`の使用なし、すべて明示的に型定義

### VII. Documentation & Traceability ✅

以下を更新:
- `docs/architecture/frontend.md`: Running状態同期の説明追加
- テストコード内のコメント
- 必要に応じてADR追加（Google Sheets同期パターン）

**判定**: すべてのConstitution原則に準拠。違反なし。

## Project Structure

### Documentation (this feature)

```
specs/[###-feature]/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```
app/
├── src/
│   ├── features/
│   │   └── <feature-name>/
│   ├── infra/
│   ├── hooks/
│   ├── lib/
│   ├── ui/
│   └── index.css
├── tests/
│   └── e2e/
├── README.md
└── package.json
```

**Structure Decision**: 既存の`app/src/features/time-tracker/`構造をそのまま使用。新規ディレクトリは作成せず、既存ファイルの拡張のみ。

## Complexity Tracking

*Constitution Checkをすべてパスしたため、このセクションは空欄*

---

## Phase 0: Research Results

**Status**: ✅ Completed

詳細は[research.md](./research.md)を参照。

**主要な決定事項**:
1. Supabase同期: 既存実装をそのまま利用（`time_tracker_running_states`テーブル対応済み）
2. Google Sheets同期: Status列とtempId列を追加、debounce（1秒）で更新
3. Running Session ID: `SessionDraft.tempId`フィールドを追加（オプショナル）
4. エラーハンドリング: ログ出力のみ、自動リトライなし

---

## Phase 1: Design & Contracts

**Status**: ✅ Completed

生成されたアーティファクト:
- [data-model.md](./data-model.md): `SessionDraft`へのtempId追加、Google Sheets Row構造
- [contracts/google-sheets-api.md](./contracts/google-sheets-api.md): `GoogleSyncClient`の新規メソッド定義
- [quickstart.md](./quickstart.md): 開発環境セットアップとTDD実装ガイド

**設計のポイント**:
- 既存の型定義を最大限活用（`RunningSessionState`, `SessionDraft`）
- Google Sheets APIの3つの新規メソッド: `appendRunningSession`, `updateRunningSession`, `completeRunningSession`
- 列マッピングの拡張: `statusColumn`, `tempIdColumn`

---

## Phase 2: Tasks Generation

**Status**: ⏳ Pending

次のステップ: タスクリストを生成

**タスク構成の想定**:
- **P1（デバイス間同期）**:
  - 既存Supabase同期のテスト追加
  - E2E: 複数デバイスシミュレーション
- **P2（Google Sheets同期）**:
  - `SessionDraft.tempId`追加
  - `googleSyncClient`の新規メソッド実装（TDD）
  - `useGoogleSpreadsheetSync`の拡張
  - E2E: Google Sheets連携

---

## Constitution Re-Check (Post-Design)

Phase 1完了後の再確認:

### I. Feature-First Architecture ✅

すべての変更は`app/src/features/time-tracker/`内で完結。

- 変更ファイル:
  - `domain/types.ts`: `SessionDraft`に`tempId`追加
  - `hooks/data/useGoogleSpreadsheetSync.ts`: Running同期機能追加
  - `infra/google/googleSyncClient.ts`: 新規メソッド追加

### II. レイヤー分離とデータフロー ✅

レイヤー構造を維持:
- Domain: `types.ts`の型拡張のみ
- Hooks: `useGoogleSpreadsheetSync`でGoogle Sheets同期
- Infra: `googleSyncClient`でAPI呼び出し

### III. Test-First Development (NON-NEGOTIABLE) ✅

TDD計画:
1. ユニットテスト: `googleSyncClient.running.test.ts`
2. Hooksテスト: `useRunningSession.sync.test.tsx`, `useGoogleSpreadsheetSync.test.tsx`
3. E2E: `running-session-sync.spec.ts`, `google-sheets-sync.spec.ts`

### IV. Incremental Delivery & User Story Independence ✅

P1とP2は独立して実装・テスト・デプロイ可能:
- P1: Supabaseデータソースの検証のみ（既存実装）
- P2: Google Sheetsクライアントの拡張（P1に依存しない）

### V. Simplicity & YAGNI ✅

新規パターン・抽象化なし:
- 既存のSupabaseデータソースをそのまま使用
- 既存のGoogle Sheets APIクライアントを拡張のみ

### VI. Type Safety & Explicit Interfaces ✅

すべての型定義は明示的:
- `SessionDraft.tempId?: string` (オプショナル)
- `GoogleSpreadsheetOptions.statusColumn?: string`
- `any`の使用なし

### VII. Documentation & Traceability ✅

以下のドキュメントを作成:
- `research.md`: 技術調査結果
- `data-model.md`: データモデル定義
- `contracts/google-sheets-api.md`: APIインターフェース
- `quickstart.md`: 開発ガイド

**判定**: すべてのConstitution原則に引き続き準拠。Phase 1設計でも違反なし。

---

## Summary

**Feature**: Running Session同期機能
**Branch**: `004-running-session-running`
**Status**: Phase 1完了、Phase 2（タスク生成）待ち

**実装アプローチ**:
- P1: 既存のSupabase同期実装の検証とテスト追加
- P2: Google Sheets同期機能の拡張（tempId追加、新規メソッド実装）

**Constitution準拠**: ✅ すべての原則に準拠

**Next Steps**:
1. タスクリスト生成
2. P1から順に実装（TDD）
3. すべてのテストがGreenになったらPR作成
