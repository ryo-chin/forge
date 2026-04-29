# サプライチェーン安全策

この repo は pnpm monorepo として扱う。ローカルマシンを守るため、依存 install は lifecycle script を実行しない設定を既定にしている。

## 安全な install

```bash
pnpm run supply-chain:check
pnpm run install:safe
```

`install:safe` は `pnpm install --frozen-lockfile --ignore-scripts` を実行する。依存 package の `preinstall` / `install` / `postinstall` / `prepare` は実行されない。

## 例外の扱い

依存 package の build script や追加 binary が必要な場合は、対象 package と理由を確認してから個別に実行する。例:

```bash
pnpm rebuild <package-name>
pnpm exec playwright install chromium
```

新しい lockfile や `npx` を追加した場合は、先に `pnpm run supply-chain:check` を通す。
