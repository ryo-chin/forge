# Push前のローカル検証

git pushを実行する前に、**変更されたファイルに応じて**以下を実行すること。

## 変更範囲の確認方法

```bash
git diff --name-only origin/main...HEAD
```

## app/ 配下を変更した場合

```bash
pnpm --filter forge-app format:check
pnpm --filter forge-app lint
pnpm --filter forge-app test:run
```

## api/ 配下を変更した場合

```bash
pnpm --filter api format:check
pnpm --filter api lint
pnpm --filter api test
```

## 実行不要なケース

- docs/, CLAUDE.md, .github/ のみの変更

## 備考

- build と e2e はCIに委ねる（ローカル実行は時間がかかるため）
- 両方変更した場合は両方のチェックを実行
