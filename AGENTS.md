# Repository Guidelines

- ユーザーへの回答は日本語で行うこと
- `prototype` ディレクトリ内の実装は他に影響を与えない形で行うこと
- ドキュメントは `docs` 配下を参照すること

## プロトタイプ実装ルール
- プロトタイプ用ブランチ名には必ず `prototype` を含め、`prototype/<branch-name>/` ディレクトリを作成してブランチ名と一致させること。
- 各プロトタイプは Cloudflare Workers で単体デプロイ可能な構成とし、依存関係をディレクトリ内で完結させること。
- ディレクトリ直下に `deploy.sh` を配置し、`set -euo pipefail` を設定した上でクリーンな環境でもワンコマンドでデプロイできるようにすること。
  - スクリプトは必要なインストール・ビルド・`wrangler deploy` までを包含すること。
  - GitHub Actions から `BRANCH_NAME_RAW` と `SANITIZED_BRANCH` の環境変数が渡されるので、Worker 名などに活用すること。
  - デプロイ完了後は `echo "DEPLOY_URL=<url>" >> "$GITHUB_OUTPUT"` の形式で URL を出力し、ワークフローが PR コメント等に利用できるようにすること。
- プロトタイプ固有の設定・実行手順は `prototype/<branch-name>/README.md` に記載すること。
