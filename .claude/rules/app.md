---
paths:
  - "app/**/*"
---

# Frontend (app/) 開発ルール

## アーキテクチャ参照

実装前に以下のドキュメントを参照すること:

- 全体概要: @docs/architecture/frontend/overview.md
- レイヤー構造: @docs/architecture/frontend/layers.md
- ディレクトリ構成: @docs/architecture/frontend/directories.md
- 実装パターン: @docs/architecture/frontend/patterns.md

## Push前の検証

git pushを実行する前に、リポジトリルートで **`pnpm verify`** を必ず実行すること。
これは CI の Lint ジョブと同じく **eslint だけでなく Biome の `format:check` も含む**
（lint + format:check + type-check + test を app/api 両方）。eslint だけ通して
format:check を忘れると CI Lint が落ちる。format 崩れは `pnpm format` で修正できる。

UI / 入力まわり（reports・daily-log 等）を変更したら、変更領域の E2E を
**`pnpm verify:e2e`** で1回ローカル実行する（初回は `pnpm --filter forge-app exec playwright install chromium` が必要）。
「e2e は CI 委ね」で push するとフィードバックが1往復遅れるので、新規・変更した spec は手元で通しておく。

build と coverage はCIに委ねてよい。
