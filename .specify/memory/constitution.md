<!--
Sync Impact Report:
- Version change: 1.0.1 → 1.1.0
- Modified principles: II. レイヤー分離とデータフロー（外部連携の責務明確化）
- Added sections: VIII. 外部サービス連携の制御
- Removed sections: None
- Templates requiring updates:
  ✅ .specify/templates/plan-template.md（憲法チェック参照時の外部連携ガイド補足）
  ✅ .specify/templates/tasks-template.md（外部API作業のワーカー経由ルール周知）
  ⚠ .specify/templates/spec-template.md（特筆すべき変更なし、現行利用継続可）
- Follow-up TODOs: None
-->

# Forge Constitution

## Core Principles

### I. Feature-First Architecture

すべての機能は `app/src/features/<feature-name>/` 配下で完結させる。UIコンポーネント、ドメインロジック、データ取得を独立したモジュールとして実装し、他の機能への依存を最小限に抑える。機能間で共有が必要な場合は、明示的な公開APIを通じて行う。

**理由**: 機能の独立性を保つことで、並行開発、テスト、デプロイが容易になり、コードの保守性が向上する。

### II. レイヤー分離とデータフロー

機能内部は責務ごとに明確にレイヤー分離する:
- `domain/`: 純粋関数、計算、バリデーション（副作用なし）
- `components/`: UI とユーザーインタラクション
- `hooks/data/`: データ取得・更新など副作用を集約
- `infra/`: プラットフォーム固有の実装（API、ストレージ、認証など）

データは `hooks/data/` から取得し、propsで子コンポーネントへ渡す。propsが煩雑な場合のみContext/Providerを使用する。外部サービスとの通信は `hooks/data/` → `infra/` → Worker/サーバー → 外部サービスという順に一方向で流れ、UI層から直接外部サービスへ到達してはならない。

**理由**: 責務の分離により、テストが容易になり、永続化・外部連携レイヤーの差し替えが可能になる。

### III. Test-First Development (NON-NEGOTIABLE)

テストは実装の前に書く。TDD サイクル（Red-Green-Refactor）を厳守する:
1. テストを書く
2. テストが失敗することを確認
3. 実装する
4. テストが成功することを確認
5. リファクタリング

ユニット/コンポーネントテストは Vitest + Testing Library、E2Eテストは Playwright を使用する。

**理由**: テストファーストにより、設計の問題を早期に発見でき、リファクタリングの安全性が保証される。

### IV. Incremental Delivery & User Story Independence

各ユーザーストーリーは独立して実装・テスト・デプロイ可能でなければならない。優先順位（P1, P2, P3）に従って段階的に価値を提供する。P1だけでMVPとして機能する。

**理由**: 早期のフィードバック獲得、リスクの最小化、並行開発の実現。

### V. Simplicity & YAGNI

必要になるまで機能を実装しない（You Aren't Gonna Need It）。複雑なパターン（Repository、Presenter/Serviceレイヤーなど）は、明確な必要性が生じるまで導入しない。まずはシンプルな実装から始める。

**理由**: 過度な抽象化は保守コストを増大させる。実際の問題が明確になってから適切な解決策を選択する。

### VI. Type Safety & Explicit Interfaces

TypeScript の型システムを最大限活用する。`any` の使用は禁止（やむを得ない場合は `unknown` を使用し、型ガードで絞り込む）。コンポーネントのpropsは明示的に型定義する。

**理由**: 型安全性により、実行時エラーを大幅に削減し、リファクタリングの安全性を確保する。

### VII. Documentation & Traceability

実装ガイドライン（`IMPLEMENTS.md`）、アーキテクチャ図、ディレクトリ構成例は常に最新に保つ。コードの意図が自明でない場合はコメントで説明する。重要な決定事項はADR（Architecture Decision Record）として記録する。

**理由**: チームメンバーの理解を助け、将来の保守を容易にする。

### VIII. 外部サービス連携の制御

外部サービスとのやり取りは必ずサーバー/Worker層で仲介し、ブラウザや純粋なクライアントコードが直接外部APIへアクセスしてはならない。外部連携時は、資格情報とフォーマット変換をサーバー側で統一し、日時・列マッピングなどの表現をユーティリティで一元管理する。クライアントは整形済みのSDK/HTTPエンドポイントを利用し、IDLの変更があればサーバー層で吸収する。

**理由**: 資格情報の保護と、連携仕様変更時の影響範囲をサーバー側に閉じ込めることで、安全で一貫した拡張が可能になる。

## Architecture Standards

### Directory Structure

```
app/
├── src/
│   ├── features/
│   │   └── <feature-name>/
│   │       ├── components/  # 機能固有UIコンポーネント
│   │       ├── domain/      # 純粋関数・ビジネスロジック
│   │       ├── hooks/
│   │       │   └── data/    # 機能固有データ取得フック
│   │       └── pages/       # ページエントリーポイント
│   ├── infra/               # プラットフォーム固有実装
│   ├── hooks/               # 共有hooks
│   ├── lib/                 # 純粋関数・ユーティリティ
│   ├── ui/                  # 共有UIコンポーネント・トークン
│   └── index.tsx            # アプリエントリーポイント
├── tests/
│   └── e2e/
├── IMPLEMENTS.md
└── package.json
```

### Technology Stack

- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite
- **State Management**: TanStack Query (React Query) for server state
- **Testing**: Vitest (unit/component), Playwright (E2E)
- **Backend / Worker**: Cloudflare Workers, Supabase REST API
- **Deployment**: Cloudflare Workers/Pages

### Code Organization Rules

- Same file changes MUST be sequential (no parallel edits)
- Different files CAN be edited in parallel
- Circular dependencies are PROHIBITED
- Feature-to-feature dependencies MUST go through explicit public APIs
- Barrel files (`index.ts`) are optional but recommended for public APIs
- 外部API連携は `app` → Worker(API) → 外部サービスのパスに限定し、資格情報はクライアントに配布しない

## Testing Strategy

### Test Coverage Requirements

- All domain logic MUST have unit tests
- All UI components MUST have component tests
- Critical user flows MUST have E2E tests
- Data fetching hooks SHOULD be tested with mocked responses

### Test Organization

- 単体・コンポーネントテストは実装ファイルと同階層に `.test.ts[x]` を配置
- 機能横断の統合テストは `app/tests` 配下に配置（必要に応じてサブディレクトリを作成）
- E2E テストは `app/tests/e2e/`
- E2E シナリオ名・テストケース名は日本語で記述する

### Mocking Strategy

- Mock `hooks/data/` functions to isolate UI/domain tests from network/storage
- Use MSW (Mock Service Worker) or equivalentで API をモックし、外部連携の契約確認は Worker 層で行う
- Avoid mocking implementation details; focus on behavior

## Development Workflow

### Feature Development Flow

1. Create feature specification (`specs/<feature>/spec.md`)
2. Generate implementation plan (`specs/<feature>/plan.md`)
3. Generate task list (`specs/<feature>/tasks.md`)
4. Implement tasks in priority order (P1 → P2 → P3)
5. Each user story MUST be independently testable
6. Deploy/demo after each story completion

### Branch Strategy

- Feature branches: `<number>-<feature-name>`
- Prototype branches: `prototype/<branch-name>` (自己完結型、他への影響なし)
- Main branch への直接コミット禁止

### Commit Guidelines

- Commit messages in Japanese
- Follow conventional commits format when applicable
- Reference issue/story numbers when relevant

## Governance

### Constitution Amendments

- Amendments require documentation of rationale and impact analysis
- Version increments follow semantic versioning:
  - **MAJOR**: Backward-incompatible principle changes
  - **MINOR**: 新しい原則の追加やガバナンスの大幅な拡張
  - **PATCH**: Clarifications, wording improvements
- All amendments MUST update dependent templates and documentation

### Compliance

- All PRs MUST comply with core principles
- Violations of NON-NEGOTIABLE principles are grounds for PR rejection
- Complexity introduced MUST be justified with clear rationale
- Use `app/IMPLEMENTS.md` と `api/IMPLEMENTS.md` を実装時の基準として参照する

### Review Process

- Code reviews MUST verify:
  - Test-first approach was followed
  - Feature independence is maintained
  - Type safety is preserved
  - Documentation is updated
  - 外部連携が必ず Worker/API 経由で制御されている

**Version**: 1.1.0 | **Ratified**: 2025-10-12 | **Last Amended**: 2025-10-24
