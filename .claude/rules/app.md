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

git pushを実行する前に、CIと同等の検証をローカルで実行すること。
コマンドは @.github/workflows/ci-frontend.yml を参照。

build と e2e はCIに委ねる（ローカル実行は時間がかかるため）。
