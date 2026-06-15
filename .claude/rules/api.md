---
paths:
  - "api/**/*"
---

# Backend (api/) 開発ルール

## Push前の検証

git pushを実行する前に、リポジトリルートで **`pnpm verify`** を必ず実行すること
（lint + Biome `format:check` + type-check + test を app/api 両方）。
api だけ変更した場合でも、CI の Lint は **eslint と Biome `format:check` の両方**を見るので、
`pnpm format` で整形してから push する。
