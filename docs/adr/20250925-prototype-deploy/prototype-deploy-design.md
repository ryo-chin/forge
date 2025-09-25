# Prototype ブランチ自動デプロイ設計

## 目的
`prototype` を含むブランチが push されたタイミングで、対応するプロトタイプを Cloudflare Workers に自動デプロイし、プレビュー URL を PR コメントとして共有できる仕組みを GitHub Actions で提供する。

## ディレクトリ構成と命名規約
- プロトタイプは `prototype/<branch-name>/` に配置し、ブランチ名とディレクトリ名を一致させる。
- 各プロトタイプディレクトリは独立した Cloudflare Workers アプリケーションとして成立する構成・依存関係を持つ。
- 各プロトタイプにはその環境だけで完結するデプロイ用シェルスクリプト（例: `prototype/<branch-name>/deploy.sh`）を同梱し、クリーン環境で一発デプロイできるようにする。
- `AGENTS.md` に上記ルールとスクリプト作成手順、実行方法を記載する。

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

2. **プロトタイプディレクトリとスクリプトの確認**
   - `prototype/${BRANCH_NAME_RAW}` と `prototype/${BRANCH_NAME_RAW}/deploy.sh` の存在確認。
   - いずれかが存在しない場合はワークフローを失敗させ、開発者に不足を通知。

3. **シェルスクリプト実行**
   - `prototype/${BRANCH_NAME_RAW}/deploy.sh` を実行。
   - スクリプト内で以下を実施する前提：
     - 依存パッケージのインストール（`npm ci` など）。
     - ビルド（必要なら `npm run build` 等）。
     - `wrangler` を用いた Cloudflare Workers へのデプロイ。
     - デプロイ URL を標準出力に明示（JSON 形式、`echo "DEPLOY_URL=..." >> $GITHUB_OUTPUT` など）。
   - 共通の引数は強制しないが、必要に応じて `BRANCH_NAME_RAW` と `SANITIZED_BRANCH` を環境変数として渡す。

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
- 各プロトタイプディレクトリに `wrangler.toml` を配置し、`account_id` の参照方法を `deploy.sh` 内で統一（例: `WRANGLER_ACCOUNT_ID` 環境変数を読み込む）。
- Worker 名はサニタイズ済みブランチ名（`SANITIZED_BRANCH`）を利用し、同一ブランチでの再デプロイは上書き。

## 命名衝突とライフサイクル
- Worker 名を `SANITIZED_BRANCH` とすることでブランチごとにユニーク化。
- ブランチ削除時の自動クリーンアップは当面非対応。必要になったら `workflow_dispatch` + `wrangler delete` など別途検討。

## 通知戦略
- ワークフロー完了後に以下を実施:
  - PR が存在すればコメントでデプロイ URL を共有。
  - Job Summary にも記載して閲覧性を確保。

## 今後のタスク
1. `AGENTS.md` にプロトタイプ作成ルール・スクリプト要件・Cloudflare シークレット設定を追記。
2. `.github/workflows/prototype-deploy.yml` を作成し、上記ジョブを実装。
3. リポジトリシークレットに `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を登録。
4. 各プロトタイプは `prototype/<branch-name>/deploy.sh` と `README.md` を用意し、自身のデプロイ手順を記載。
