# 回答
- 常に日本語で回答してください

# 開発方針

このプロジェクトはPhase2: 自律駆動開発を目指しています。

## 司法（ガードレール）がSSOT

以下の司法に従って開発を行ってください。docsは司法の「人間向け表現」です。

### 原則: ドキュメントより機械的強制を優先

情報を追加する前に:
1. ESLint/Biome/テストで強制できないか検討する
2. ドキュメントは「最後の手段」
3. 書く場合はSSoTを守り、重複を避ける（@で参照）

### 細則主義（0/1判定）

| 対象 | 司法（SSOT） |
|-----|-------------|
| 機能仕様 | `app/tests/e2e/` のE2Eテスト |
| 型安全性 | `tsconfig.json` + TypeScript型定義 |
| アーキテクチャ境界 | `app/.eslintrc.cjs` |
| コード品質 | `biome.json` |

### 原則主義（スコア判定）

| 対象 | 司法（SSOT） |
|-----|-------------|
| 命名・責務分割・UX | `guards/judge/criteria/*.yml`（将来実装） |

## 参考（司法の人間向け表現）

### アーキテクチャ（Frontend）

- 全体概要: `docs/architecture/frontend/overview.md`
- レイヤー構造: `docs/architecture/frontend/layers.md`
- ディレクトリ構成: `docs/architecture/frontend/directories.md`
- 実装パターン: `docs/architecture/frontend/patterns.md`

### アーキテクチャ（Backend）

- API設計: `docs/architecture/backend.md`

### その他

- セットアップ手順: `app/README.md`, `api/README.md`
- 意思決定記録: `docs/adr/`
- 設計思想: `guards/README.md`
- AI駆動開発ガイド: `docs/guides/ai-driven-development.md`

## 開発ツール

- **パッケージマネージャー**: pnpm（monorepo構成）
- **フォーマット・基本Lint**: Biome
- **カスタムLint**: ESLint（プロジェクト固有ルールのみ）

