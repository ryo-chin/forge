# Google Spreadsheet Sync Worker

Time TrackerのセッションをGoogle Spreadsheetsへ同期するためのCloudflare Workerです。

## 機能

- **OAuth 2.0 認証**: Googleアカウントとの安全な連携
- **トークン自動リフレッシュ**: アクセストークンの期限切れ5分前に自動更新
- **スプレッドシート操作**: Google Sheets APIを使用した読み書き
- **セッション同期**: Time Trackerのセッションをスプレッドシートへ自動追記
- **カラムマッピング**: フィールドとスプレッドシート列の柔軟なマッピング（列記号・ヘッダー名対応）
- **エラーハンドリング**: 同期失敗時のログ記録とリトライ機能

## エンドポイント

### OAuth
- `POST /integrations/google/oauth/start` - OAuth認証フローの開始
- `GET /integrations/google/oauth/callback` - OAuth認証のコールバック
- `POST /integrations/google/oauth/revoke` - Google連携の解除

### 設定
- `GET /integrations/google/settings` - 現在の設定を取得
- `PUT /integrations/google/settings` - スプレッドシート・シート・カラムマッピングを更新
- `GET /integrations/google/spreadsheets` - アクセス可能なスプレッドシート一覧
- `GET /integrations/google/spreadsheets/{id}/sheets` - スプレッドシート内のシート一覧

### 同期
- `POST /integrations/google/sync` - セッションをスプレッドシートへ同期

## ローカル開発

### セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .dev.vars.example .dev.vars
# .dev.varsを編集して認証情報を設定
```

### 開発サーバーの起動

```bash
npm run dev
```

Worker が `http://localhost:8787` で起動します。

### テスト

```bash
npm test
```

## デプロイ

```bash
# 本番環境へデプロイ
npm run deploy

# シークレットの設定（初回のみ）
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put GOOGLE_REDIRECT_URI
```

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `SUPABASE_URL` | Supabase プロジェクト URL | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | ✓ |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | ✓ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアント シークレット | ✓ |
| `GOOGLE_REDIRECT_URI` | OAuth リダイレクト URI | ✓ |

## アーキテクチャ

```
src/
├── index.ts                 # エントリーポイント、ルーティング
├── env.ts                   # 環境変数の型定義
├── types.ts                 # 共通型定義
├── auth/
│   └── verifySupabaseJwt.ts # Supabase JWT検証
├── handlers/
│   ├── oauth.ts             # OAuth認証ハンドラー
│   ├── settings.ts          # 設定管理ハンドラー
│   └── syncSession.ts       # セッション同期ハンドラー
├── repositories/
│   └── googleConnections.ts # Supabase データアクセス層
├── services/
│   └── googleSheetsClient.ts # Google Sheets API クライアント
└── http/
    └── response.ts          # HTTPレスポンスヘルパー
```

## セキュリティ

- すべてのエンドポイントでSupabase JWTによる認証が必要
- Google OAuth トークンは暗号化してSupabaseに保存
- Row Level Security (RLS) によるデータアクセス制御
- シークレット情報は環境変数として管理（コードに含めない）

## 詳細なセットアップ手順

プロジェクトルートの `docs/specs/google-sheets-integration/quickstart.md` を参照してください。
