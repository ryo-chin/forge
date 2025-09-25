# Training Tracker Prototype

`docs/design/20250925.md` の要求をベースに、軽快な鍛錬タイムトラッカー体験を検証するためのプロトタイプです。Cloudflare Workers 上で静的アセットとして配信する構成になっています。

## 主な機能
- **ワンフィールド即スタート**: タスク名を入力して Enter / 「開始」で直ちにセッション開始。
- **サジェスト**: 最近のセッションから候補を提示し、ワンタップで開始。
- **開始時刻の柔軟調整**: "+/-" ボタン、スクラバー、ナチュラル入力（例: `-25m`, `昨日 22:05`）で調整可能。Undo ボタンで直前の補正を戻せます。
- **セッション中編集**: スキル/タグ/強度/メモの編集は進行中でも反映。
- **タイムラインと編集**: 当日の記録をリスト化し、ダイアログで詳細編集・削除が可能。
- **習慣メトリクス**: 直近ストリーク日数と週合計時間をヘッダーに表示。

## ディレクトリ構成
```
prototype/prototype-training-tracker/
├── package.json          # ビルド・開発スクリプト
├── scripts/build.mjs     # esbuild を用いたバンドル & コピー処理
├── src/                  # ソース (HTML/CSS/JS)
├── dist/                 # `npm run build` で生成される成果物
├── wrangler.toml         # Wrangler 設定 ([assets] 配信)
└── README.md             # このファイル
```

## 開発手順
```bash
cd prototype/prototype-training-tracker
npm install
npm run dev
```

- `npm run dev` は毎回 `npm run build` を実行した後、`npx wrangler dev --local` を起動します。
- ライブリロードはありません。変更時は `Ctrl+C` で停止し、再度 `npm run dev` を実行してください。

## ビルド
```bash
npm run build
```

- `dist/` 配下に `index.html` と `assets/main.js` が生成されます。
- 生成物は Cloudflare Workers の静的アセット ([assets]) として配信されます。

## デプロイ
```bash
npm run build
npx wrangler deploy --name ${SANITIZED_BRANCH}
```

- GitHub Actions からは `npm run build` と `npx wrangler deploy` を順に実行する運用を想定しています。
- `wrangler.toml` の `name` はローカルプレースホルダーであり、Actions 側で `--name ${SANITIZED_BRANCH}` を渡してください。

## 依存関係について
- Node.js 18 以上を想定しています。
- 追加の外部サービス連携はありません。すべての状態はブラウザの `localStorage` に保存され、Cloudflare 側に依存しません。

## 今後の検証ポイント
- サジェストロジックを曜日/時間帯・タグ学習に拡張する。
- 計測中 UI のアクセシビリティ検証（スクリーンリーダー操作）。
- ワークアウトのテンプレート化や OKR 連携の導線整備。
