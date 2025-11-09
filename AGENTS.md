# Repository Guidelines

- ユーザーへの回答は日本語で行うこと
- `prototype` ディレクトリ内の実装は他に影響を与えない形で行うこと
- ドキュメントは `docs` 配下を参照すること
- `app/` の実装時は `app/README.md` の方針を必ず確認すること
- 実装完了後はリポジトリルートで `make ci` を実行し、lint / unit-test / build / e2e / API lint-test の成功を確認してから成果物を共有すること

## プロトタイプ実装ルール
- プロトタイプ用ブランチ名には必ず `prototype` を含め、`prototype/<branch-name>/` ディレクトリを作成してブランチ名と一致させること。
- 各プロトタイプは Cloudflare 上で完結するよう依存関係をディレクトリ内に閉じ込め、`npm install` / `npm run build` だけで成果物を生成できる状態を維持すること。
- GitHub Actions から `BRANCH_NAME_RAW` と `SANITIZED_BRANCH` の環境変数が渡される。必要に応じてビルドや `wrangler.toml` 内で参照すること。
- プロトタイプ固有の開発/起動手順は `prototype/<branch-name>/README.md` に明記すること。

### 標準パターン（静的アセットを Workers で配信）
- `package.json` の `scripts.build` にビルドコマンドを定義し、静的アセットを `dist/`（または `build/`）に出力すること。
- `wrangler.toml` に `[assets]` セクションを定義し、ビルド成果物ディレクトリを `directory = "dist"` のように指定すること。
- `wrangler.toml` の `name` は仮の値で構わない（Actions で `--name ${SANITIZED_BRANCH}` を指定して上書きする）。
- `wrangler deploy` はビルド済みアセットを Workers の静的配信としてアップロードする。必要に応じて `[vars]` や `[kv_namespaces]` などを追加すること。

### その他
- ローカル開発用の `npm run dev` などは任意で用意して良い。Wrangler や Vite などの開発サーバーを利用して構わない。
