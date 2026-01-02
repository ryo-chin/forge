# Implementation Plan: TimeTrackerPage モバイル最適化

**Branch**: `002-sp-web-markup` | **Date**: 2025-10-13 | **Spec**: [`spec.md`](../002-sp-web-markup/spec.md)  
**Input**: Feature specification from `/specs/002-sp-web-markup/spec.md`

## Summary

TimeTrackerPage をスマートフォンでも操作しやすくするため、タイマー操作のファーストビュー化、左メニューのハンバーガー化、進行中セッション編集や履歴操作のモバイル最適化を段階的に実装する。レスポンシブレイアウトとタップ領域拡大を中心に UI 改修を行い、既存のデータ取得や同期フローはそのまま活かす。

## Technical Context

**Language/Version**: TypeScript (React 18)  
**Primary Dependencies**: Vite, React Router, TanStack Query, TailwindなしのプレーンCSS（既存CSSユーティリティ）  
**Storage**: LocalStorage（時間記録永続化）、Google スプレッドシート同期（既存フック）  
**Testing**: Vitest + React Testing Library、Playwright（E2E）  
**Target Platform**: Web（デスクトップ/モバイル、特に viewport 320〜480px）  
**Project Type**: Web アプリ（単一リポジトリ、フロントエンド）  
**Performance Goals**: P1 フロー（開始・停止操作）が 30 秒以内に完了し、横スクロール 0 回（SC-001/002 に準拠）  
**Constraints**: レイアウト崩れ防止、ハンバーガー展開中の背面操作禁止、安全領域考慮、既存同期導線保持  
**Scale/Scope**: TimeTrackerPage 1 ページ＋共通メニュー領域のレスポンシブ調整（P1〜P4 ユーザーストーリー）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **Feature-First Architecture**: 変更対象を `app/features/time-tracker/` と既存のレイアウト共有箇所に限定し、他機能への影響を避ける → **PASS**
- **レイヤー分離**: UI 調整はページ・コンポーネント層で完結させ、ドメイン/データ層の副作用を変更しない → **PASS**
- **Test-First Development (NON-NEGOTIABLE)**: ビューポート別 UI を Vitest/Playwright のテストで先に定義し、TDD フローを計画 → **PASS**
- **Incremental Delivery**: P1 (タイマー操作) → P2 (メニュー) → P3 (進行中編集) → P4 (履歴) の段階実装でユーザーストーリー独立性を確保 → **PASS**
- **Simplicity & YAGNI**: 既存 CSS と状態管理を活用し、新規フレームワークや複雑な状態管理は導入しない → **PASS**
- **Type Safety & Explicit Interfaces**: 既存 TypeScript 型を維持し、必要な場合は props 型を拡張する → **PASS**
- **Documentation & Traceability**: 本プランと後続の quickstart/data-model/contract ドキュメントで決定事項を記録 → **PASS**

## Project Structure

### Documentation (this feature)

```
specs/002-sp-web-markup/
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
├── features/
│   └── time-tracker/
│       ├── components/
│       ├── domain/
│       ├── hooks/
│       ├── pages/
│       │   └── TimeTracker/
│       │       ├── TimeTrackerPage.tsx
│       │       └── logic.ts
│       └── index.css
├── ui/                    # 共有レイアウト/ナビゲーションがある場合に調整
├── infra/
├── lib/
└── tests/
    └── e2e/
```

**Structure Decision**: TimeTracker 機能配下と共通 UI レイアウト（必要に応じて `app/ui`）のみを改修対象とし、既存レイヤー構成を維持する。

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
