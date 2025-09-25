# App by Codex

`app-by-codex/` はアプリケーション全体のルートです。初期実装としてタイムトラッカーMVPのUIを `features/time-tracker/` 配下に配置しています。

## 実装ガイドライン

- **バレルファイル運用**: 各機能モジュールは `features/<feature>/src/index.ts` から公開し、外部公開 API を集約する。
- **テスト戦略**: ユニット/コンポーネントは Vitest + Testing Library、E2E は Playwright を使用し、TDD を基本とする。
- **アーキテクチャ原則**: 即時スタート体験を維持し、情報は段階的に開示し、`Session { id, title, startedAt, endedAt, durationSeconds, ... }` を共通スキーマとして扱う。

## セットアップ

```bash
npm install
```

## 利用可能なスクリプト

- `npm run dev` — Vite 開発サーバーを起動
- `npm run lint` — ESLint による静的解析
- `npm run test:unit` — Vitest でユニットテストを実行
- `npm run test:e2e` — Playwright でE2Eテストを実行
- `npm run build` — 型チェックと本番ビルドを実行

## 参考ドキュメント

- CSS ガイドライン: `docs/adr/app-by-codex/20250925-css-guidelines.md`
