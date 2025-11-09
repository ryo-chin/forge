# Implementation Plan: Manage Sessions by Higher-Level Theme

**Branch**: `005-manage-by-project` | **Date**: 2025-11-09 | **Spec**: `/specs/005-manage-by-project/spec.md`  
**Input**: Feature specification + research notes from `/specs/005-manage-by-project/`

## Summary

セッション分類を「テーマ（上位概念）> プロジェクト（既存 concept）」の 2 階層へ拡張し、LocalStorage と Supabase 双方でテーマ情報を永続化する。既存プロジェクトはそのまま扱い、データ層には `themeId` / `projectId` / `classificationPath` を追加して将来の階層拡張に備える。UI は Composer・ThemeManager を中心に、テーマ CRUD と 2 段セレクタへ改修し、Google Sheets 連携にも Theme 列を追加する。

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x + React 18 (Vite)  
**Primary Dependencies**: TanStack Query, Supabase JS client, Zustand, date-fns, Playwright/Vitest  
**Storage**: LocalStorage (browser) + Supabase Postgres (`time_tracker_*` tables)  
**Testing**: Vitest + Testing Library for unit/UI, Playwright for E2E  
**Target Platform**: Web (Vite dev server, Cloudflare Pages/Workers deploy)  
**Project Type**: SPA front-end with Workers API  
**Performance Goals**: テーマ/プロジェクト CRUD およびセッション開始は <200ms (UX要件)  
**Constraints**: オフライン維持（LocalStorage fallback）、Supabase 行レベルセキュリティ、Worker 経由で外部サービスアクセス  
**Scale/Scope**: 単独ユーザー想定だが、将来の multi-owner を見据え `ownerId` 必須

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **外部連携制御 (Principle VIII)**: Google Sheets 連携や Supabase API は必ず Worker/API レイヤー経由で行い、React から直接外部トークンを扱わない。
- **Feature-First/Layered (Principles I & II)**: すべてのテーマ関連ロジックを `app/src/features/time-tracker` 内で完結させ、domain ↔ hooks ↔ infra の依存方向を守る。
- **Type Safety (Principle VI)**: Supabase クライアントは `Database` 型を付与し、`classificationPath` 含む新カラムを型で保証する。`any` 禁止。
- **Prototype Isolation (Principle IX)**: 本件は本体アプリの機能開発であり、prototype ディレクトリを汚染しない。
- **Test-First (Principle III)**: 新規ドメインユーティリティや hooks には Vitest を先に追加し、最低限の Red-Green サイクルを守る。

## Project Structure

### Documentation (this feature)

```
specs/005-manage-by-project/
├── plan.md          # 実装方針（このファイル）
├── research.md      # 既存セッションの分類課題と命名決定
├── data-model.md    # Theme/Project/Session エンティティ
├── quickstart.md    # ローカル手順とマイグレーション確認
├── contracts/       # API/DB I/F（未着手→Phase 1で作成予定）
└── tasks.md         # 実装タスク（/speckit.tasks で更新済み）
```

### Source Code (repository root)

```
app/
├── src/
│   ├── features/
│   │   └── time-tracker/
│   │       ├── components/
│   │       ├── domain/
│   │       ├── hooks/
│   │       │   └── data/
│   │       └── pages/
│   ├── infra/
│   │   └── repository/TimeTracker
│   ├── lib/
│   └── infra/localstorage
├── tests/
│   └── e2e/
├── IMPLEMENTS.md
└── package.json
```

**Structure Decision**: 既存の feature-first 構造を踏襲し、テーマ機能は `features/time-tracker` 配下で UI/ドメイン/データ取得を閉じる。永続化や Supabase スキーマ変更は `app/src/infra` と `db/migrations` に限定し、外部統合（Google Sheets）は `app/src/infra/google` で処理する。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* |  |  |
