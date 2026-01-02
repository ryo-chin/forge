# 回答
- 常に日本語で回答してください

# 開発方針

このプロジェクトはPhase2: 自律駆動開発を目指しています。

## 司法（ガードレール）がSSOT

以下の司法に従って開発を行ってください。docsは司法の「人間向け表現」です。

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

- アーキテクチャ背景: `docs/architecture/`
- セットアップ手順: `app/README.md`, `api/README.md`
- 意思決定記録: `docs/adr/`
- 設計思想: `guards/README.md`

## 開発ツール

- **パッケージマネージャー**: pnpm（monorepo構成）
- **フォーマット・基本Lint**: Biome
- **カスタムLint**: ESLint（プロジェクト固有ルールのみ）

## Push前のチェック

コードをpushする前に、CIと同じチェックを必ずローカルで実行すること:

```bash
pnpm --filter forge-app format:check  # Biomeによるフォーマット・lint
pnpm --filter forge-app lint          # ESLintによるカスタムルール
pnpm --filter forge-app test:run      # ユニットテスト
```

注意: `pnpm test` はwatchモードで起動するため、CI/スクリプトでは `test:run` を使用すること
