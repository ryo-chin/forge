# Forge

Time Tracker with Google Spreadsheet integration

## Development

### Quick Start

```bash
# プロジェクト全体のセットアップ
pnpm install

# フォーマット・Lintの実行（プロジェクト全体）
pnpm format:check   # Biome (format + lint)
pnpm lint           # ESLint (カスタムルールのみ)

# 各サブプロジェクトの起動
cd app && pnpm dev           # Frontend
cd api && pnpm dev           # API Worker
```

### サブプロジェクト

- **Frontend**: [app/README.md](/app/README.md)
- **API Worker**: [api/README.md](/api/README.md)

### コード品質

```bash
# プロジェクト全体
pnpm format:check     # Biome (format + 基本lint)
pnpm format           # Biome 自動修正
pnpm lint             # ESLint (カスタムルール: import制限等)
pnpm lint:fix         # ESLint 自動修正

# サブプロジェクト別
pnpm lint:app         # Frontend のみ
pnpm lint:worker      # API Worker のみ
```

**ツール構成:**
- **Biome**: フォーマット + 基本的なlint（推奨ルール）
- **ESLint**: プロジェクト固有のカスタムルール（`import/no-internal-modules`、`react-hooks`等）

## Deploy
[deploy.md](/docs/deploy.md)

## Authentication
[authentication.md](/docs/authentication.md)
