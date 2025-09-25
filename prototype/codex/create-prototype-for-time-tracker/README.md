# Training Tracker Prototype

簡易なトレーニング記録用プロトタイプです。`prototype/codex/create-prototype-for-time-tracker` ディレクトリ内で完結するように構成しています。

## 構成
- `index.html` / `styles.css` / `app.js`: UI とロジックを提供する静的ファイル
- `scripts/build.js`: HTML/CSS/JS をインライン化し、Cloudflare Workers 用の `dist/worker.mjs` を生成
- `package.json`: `npm run build` でビルドが実行できるようにする設定
- `wrangler.toml`: Wrangler のエントリーポイント設定
- `deploy.sh`: ローカルでビルドと `wrangler deploy` をまとめて実行する補助スクリプト

## 事前準備
- Node.js 18 以上
- `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を環境変数として設定
- Cloudflare API トークンには `Workers Scripts:Edit` 権限が必要

## ローカル開発
```bash
cd prototype/codex/create-prototype-for-time-tracker
npm install
npm run dev
```

- `npm run dev` は都度 `npm run build` を実行し、続いて `npx wrangler dev --local` でローカルサーバーを起動します
- ライブリロードは備えていないため、変更時は `Ctrl+C` で停止した上で再度 `npm run dev` を実行してください
- ビルド成果物は `dist/worker.mjs` と `dist/index.inline.html`

## デプロイ手順
```bash
cd prototype/codex/create-prototype-for-time-tracker
./deploy.sh       # npm run build && npx wrangler deploy を実行
```

### GitHub Actions からの実行
- `.github/workflows/prototype-deploy.yml` で `npm install` → `npm run build` → `npx wrangler deploy` を実行
- Worker 名はブランチ名をサニタイズした値に差し替えられ、同じブランチで再デプロイすると上書き更新されます
- デプロイ完了後は Actions ジョブ出力 `DEPLOY_URL` にデプロイ先 URL が設定され、PR コメントでも共有されます

## リンク
- Cloudflare Workers: <https://developers.cloudflare.com/workers/>
- Wrangler CLI: <https://developers.cloudflare.com/workers/wrangler/>
