# Forge

Time Tracker with Google Spreadsheet integration

## Development

### Quick Start

```bash
# プロジェクト全体のセットアップ
npm install

# Lintの実行（プロジェクト全体）
npm run lint

# 各サブプロジェクトの起動
cd app && npm run dev           # Frontend
cd workers/google-sync && npm run dev  # Worker
```

### サブプロジェクト

- **Frontend**: [app/README.md](/app/README.md)
- **Google Sync Worker**: [workers/google-sync/README.md](/api/google-sync/README.md)

### コード品質

```bash
# プロジェクト全体
npm run lint          # ESLint実行（app + worker）
npm run lint:fix      # ESLint自動修正（app + worker）

# サブプロジェクト別
npm run lint:app      # Frontend のみ
npm run lint:worker   # Worker のみ
```

**注意**: ESLint設定は各サブプロジェクト（`app/.eslintrc.cjs`, `workers/google-sync/.eslintrc.cjs`）で独立して管理されています。

## Deploy
[deploy.md](/docs/deploy.md)

## Authentication
[authentication.md](/docs/authentication.md)
