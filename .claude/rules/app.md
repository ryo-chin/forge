---
paths:
  - "app/**/*"
---

# Frontend (app/) 開発ルール

## Push前の検証

git pushを実行する前に、CIと同等の検証をローカルで実行すること。
コマンドは @.github/workflows/ci-frontend.yml を参照。

build と e2e はCIに委ねる（ローカル実行は時間がかかるため）。
