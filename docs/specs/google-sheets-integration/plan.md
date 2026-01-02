# Implementation Plan: Google Spreadsheet Integration for Time Tracker

**Branch**: `001-app-features-time` | **Date**: 2025-10-12 | **Spec**: specs/001-app-features-time/spec.md
**Input**: Feature specification from `/specs/001-app-features-time/spec.md`

## Summary

Time Tracker のセッション停止時に DB と Google スプレッドシートへ同期するワークフローを実現する。P1 では Google OAuth 認証とスプレッドシート／シート選択、停止イベントからの即時同期を提供し、P2 でカラムマッピングの柔軟化を行う。同期処理は既存の Supabase 永続化と連携し、UI・設定は `app/features/time-tracker` 配下で完結させる。

## Technical Context

**Language/Version**: TypeScript 5.4 + React 18  
**Primary Dependencies**: Vite 5, @tanstack/react-query 5, Supabase JS 2, Google Sheets API クライアント (NEEDS CLARIFICATION: Cloudflare Pages/Workers での採用ライブラリ)  
**Storage**: Supabase PostgreSQL (既存), Google Sheets (外部同期先; アクセス経路 NEEDS CLARIFICATION)  
**Testing**: Vitest + Testing Library, Playwright  
**Target Platform**: Web (ブラウザ UI / Cloudflare Pages、Workers 経由の API 連携)  
**Project Type**: Web フロントエンド (単一プロジェクト)  
**Performance Goals**: SC-002: セッション停止からスプレッドシート追記まで <= 5秒  
**Constraints**: Google OAuth トークン安全管理、DB成功後にシート追記する同期順序 (詳細ハンドリング NEEDS CLARIFICATION)、Cloudflare 環境での Google API 呼び出し制約 NEEDS CLARIFICATION  
**Scale/Scope**: 主に個人/小規模チーム利用を想定 (実ユーザー数や同時書き込み件数 NEEDS CLARIFICATION)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Feature-First Architecture**: PASS — 実装は `app/features/time-tracker` 配下に閉じ込め、共有化が必要な場合のみ公開 API を介す。  
- **レイヤー分離とデータフロー**: PASS — Google 連携の副作用は `hooks/data` と `infra` に集約し、UI/ドメインは純粋ロジックを維持する。  
- **Test-First Development (NON-NEGOTIABLE)**: PASS — 同期処理/設定管理のユニットテストと UI/E2E テストを実装前に記述し、Red-Green-Refactor を厳守する。  
- **Incremental Delivery & Story Independence**: PASS — P1 (自動同期 + スプレッドシート選択) と P2 (カラムマッピング) を独立完了可能な段階に分割する。  
- **Type Safety & Explicit Interfaces**: PASS — 新規の設定・同期データ型を TypeScript で定義し `any` は使用しない。  
- **Documentation & Traceability**: PASS — 本計画に沿って `research.md`・`data-model.md`・`quickstart.md` を更新し、重要決定は必要に応じて ADR を追加する。

> Phase 1 設計後の再確認 (2025-10-12): 上記ゲートに新たな違反なし。PASS 継続。

## Project Structure

### Documentation (this feature)

```
specs/001-app-features-time/
├── plan.md              # このファイル
├── research.md          # Phase 0 成果物
├── data-model.md        # Phase 1 成果物
├── quickstart.md        # Phase 1 成果物
├── contracts/           # Phase 1 成果物
└── tasks.md             # Phase 2 成果物
```

### Source Code (repository root)

```
app/
├── features/
│   └── time-tracker/
│       ├── components/
│       ├── domain/
│       ├── hooks/
│       │   └── data/
│       └── pages/
├── hooks/
│   └── data/
├── infra/
│   ├── api/
│   └── google/          # Google API 連携用に追加検討 (NEEDS CLARIFICATION)
├── lib/
└── ui/
```

**Structure Decision**: 既存のフロントエンド単一プロジェクト構成を維持しつつ、Time Tracker 機能配下で UI・設定・同期ロジックを閉じ込める。Google API 連携の副作用コードは `app/infra` 配下に配置し、React Query フック経由でページへ供給する。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
