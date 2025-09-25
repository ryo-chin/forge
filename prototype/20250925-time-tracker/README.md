# Training Tracker Prototype

最小構成のタイムトラッカー UI プロトタイプです。中央の入力バーにキーワードを入れて Enter（または「スタート」ボタン）で計測を開始し、「ストップ」でログに追加されます。履歴は直近 5 件のみ保持します。

## セットアップ

```bash
npm install
```

## 開発サーバー

```bash
npm run dev
```

## ビルド

```bash
npm run build
```

Vite が `dist/` に静的アセットを出力します。

## デプロイ（想定）

Cloudflare Workers Assets を利用する構成です。

```bash
npm run build
npx wrangler deploy --name ${SANITIZED_BRANCH}
```

## 既知の制約

- ローカルストレージ連携や詳細編集機能は未実装です。
- 履歴はページをリロードすると消えます。
- サジェストやタグ入力などの要件は今後の拡張で対応予定です。
