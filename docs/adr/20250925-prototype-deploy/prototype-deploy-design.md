# Prototype ブランチ自動デプロイ設計

## 目的
`prototype` を含むブランチが push されたタイミングで、対応するプロトタイプを Cloudflare Workers に自動デプロイし、プレビュー URL を PR コメントとして共有できる仕組みを GitHub Actions で提供する。

## ディレクトリ構成と命名規約
- プロトタイプは `prototype/<branch-name>/` に配置し、ブランチ名とディレクトリ名を一致させる。
- 各プロトタイプディレクトリは独立した Cloudflare Workers アプリケーションとして成立する構成・依存関係を持つ。
- `package.json` を用意し、`npm run build` でデプロイに必要なアーティファクトを生成できるようにする。
- `wrangler.toml` を設置し、`npx wrangler deploy --name <sanitized-branch>` でデプロイできるようにする。
- これらのルールは `AGENTS.md` にも記載し、開発者ガイドラインとして共有する。

## GitHub Actions ワークフロー概要
- ファイル: `.github/workflows/prototype-deploy.yml`
- トリガー:
  - `push`: `refs/heads/*prototype*` を対象。
  - `workflow_dispatch`: 手動実行を許可。
- ジョブ構成: `deploy-prototype` 単一ジョブを想定。

### 処理フロー
1. **ブランチ名の抽出と正規化**
   - `github.ref_name` を `BRANCH_NAME_RAW` として取得。
   - Cloudflare リソース名に利用可能な形式へサニタイズ（`/` や `_` を `-` へ置換、英数字とハイフンのみなど）。
   - 正規化後の名前を `SANITIZED_BRANCH` として環境変数に設定。

2. **プロトタイプディレクトリの検証**
   - `prototype/${BRANCH_NAME_RAW}` と `package.json` の存在確認。
   - 未整備の場合はワークフローを失敗させ、開発者に不足を通知。

3. **ビルドとデプロイ**
   - `npm install` / `npm ci` で依存関係を解決。
   - `npm run build` を実行し、デプロイ用ビルドを生成。
   - `npx wrangler deploy --name ${SANITIZED_BRANCH}` を実行し、Cloudflare Workers にデプロイ。
   - Wrangler の出力からデプロイ URL を抽出し、ジョブ出力 (`DEPLOY_URL`) に設定。

4. **PR コメント / 出力整理**
   - `actions/github-script` 等でデプロイ URL を取得し、関連 PR が存在する場合はコメント投稿。
   - 併せて `GITHUB_STEP_SUMMARY` にデプロイ結果を記載し、Actions 画面から参照できるようにする。

## 必要なシークレット・環境変数
- `CLOUDFLARE_API_TOKEN`
  - Cloudflare Workers の `Workers Scripts:Edit` 等のスコープを付与した API トークン。
- `CLOUDFLARE_ACCOUNT_ID`
  - Cloudflare アカウント ID。環境変数としてワークフローに注入。
- Wrangler CLI が必要とする追加パラメータがあれば、各プロトタイプでスクリプト内に記載する。

## Wrangler / Cloudflare 設定
- 各プロトタイプディレクトリに `wrangler.toml` を配置し、`account_id` や `main` などの設定を行う。`account_id` は環境変数 `CLOUDFLARE_ACCOUNT_ID` を参照できるよう `${env.CLOUDFLARE_ACCOUNT_ID}` を利用してもよい。
- Worker 名は CLI 引数の `--name ${SANITIZED_BRANCH}` で上書きする運用とし、同一ブランチでの再デプロイは上書き。

## 命名衝突とライフサイクル
- Worker 名を `SANITIZED_BRANCH` とすることでブランチごとにユニーク化。
- ブランチ削除時の自動クリーンアップは当面非対応。必要になったら `workflow_dispatch` + `wrangler delete` など別途検討。

## 通知戦略
- ワークフロー完了後に以下を実施:
  - PR が存在すればコメントでデプロイ URL を共有。
  - Job Summary にも記載して閲覧性を確保。

## 今後のタスク
1. `AGENTS.md` にプロトタイプ作成ルール（`npm run build` / `npx wrangler deploy` の利用、`wrangler.toml` 整備など）を記載。
2. `.github/workflows/prototype-deploy.yml` を実装し、ビルドからデプロイまでの自動化を構築。
3. リポジトリシークレットに `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録。
4. 各プロトタイプは `prototype/<branch-name>/README.md` に開発・デプロイ手順をまとめ、必要な依存関係・`wrangler.toml` を含める。
