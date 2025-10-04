# 推奨コマンド

## 開発用コマンド（app/内で実行）

### セットアップ
```bash
cd app
npm install
```

### 開発サーバー
```bash
npm run dev          # Vite開発サーバーを起動
```

### ビルド・型チェック
```bash
npm run build        # 型チェック + 本番ビルド
npm run preview      # ビルド結果をプレビュー
```

### テスト
```bash
npm run test         # Vitest（watchモード）
npm run test:unit    # Vitestでユニットテスト実行
npm run test:e2e     # PlaywrightでE2Eテスト実行
```

### リント・フォーマット
```bash
npm run lint         # ESLintによる静的解析
```

## プロトタイプ開発（prototype/<branch-name>/内で実行）

### 標準パターン
```bash
npm install          # 依存関係インストール
npm run build        # 静的アセットをdist/に出力
npm run dev          # ローカル開発サーバー（任意）
wrangler deploy      # Cloudflare Workersにデプロイ
```

## Git操作
```bash
git status           # 作業ツリー状態確認
git add .            # 変更をステージング
git commit -m "..."  # コミット
git push origin <branch>  # リモートプッシュ
```

## システムコマンド（macOS）
```bash
ls                   # ファイル一覧
find                 # ファイル検索
grep                 # テキスト検索（ripgrep/rg推奨）
cd                   # ディレクトリ移動
```