# Forge API Worker

Time Trackerの本体状態とGoogle Spreadsheets同期を扱うCloudflare Workerです。

## 機能

- **OAuth 2.0 認証**: Googleアカウントとの安全な連携
- **トークン自動リフレッシュ**: アクセストークンの期限切れ5分前に自動更新
- **スプレッドシート操作**: Google Sheets APIを使用した読み書き
- **セッション同期**: Time Trackerのセッションをスプレッドシートへ自動追記
- **Time Tracker 本体API**: 実行中セッションの開始・更新・停止・キャンセルをSupabaseへ保存
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

### Time Tracker 本体
- `GET /time-tracker/running` - 実行中セッション状態を取得
- `POST /time-tracker/running/start` - 実行中セッションを開始
- `PATCH /time-tracker/running/update` - 実行中セッションの下書き・経過秒数を更新
- `POST /time-tracker/running/stop` - 実行中セッションを完了セッションとして保存し、実行中状態を解除したうえでGoogle Sheets同期を試行
- `POST /time-tracker/running/cancel` - 実行中状態をキャンセル

Time Tracker 本体APIはSupabaseのcanonical stateを更新します。`stop` はSupabaseへの完了セッション保存を成功条件とし、Google Sheets同期結果は `sync.status` (`success` / `skipped` / `failed`) としてレスポンスに含めます。Sheets同期失敗時もSupabaseの記録はロールバックしません。

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
wrangler secret put OAUTH_STATE_SIGNING_SECRET
wrangler secret put TOKEN_ENCRYPTION_KEY
```

## 環境変数

| 変数名 | 説明 | 必須 |
|--------|------|------|
| `SUPABASE_URL` | Supabase プロジェクト URL | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key | ✓ |
| `GOOGLE_CLIENT_ID` | Google OAuth クライアント ID | ✓ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth クライアント シークレット | ✓ |
| `GOOGLE_REDIRECT_URI` | OAuth リダイレクト URI | ✓ |
| `OAUTH_STATE_SIGNING_SECRET` | Google OAuth state をHMAC署名するための32 byte以上のランダム値 | ✓ |
| `TOKEN_ENCRYPTION_KEY` | Google OAuth token をAES-GCM暗号化する32 byte key | ✓ |

`TOKEN_ENCRYPTION_KEY` は32 byteのランダム値をbase64/base64urlまたは64桁hexで設定します。

```bash
openssl rand -base64 32
```

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
│   ├── syncSession.ts       # セッション同期ハンドラー
│   └── timeTracker.ts       # Time Tracker 本体APIハンドラー
├── repositories/
│   ├── googleConnections.ts # Google連携用Supabase データアクセス層
│   └── timeTracker.ts      # Time Tracker用Supabase データアクセス層
├── security/
│   └── tokenCrypto.ts       # Google OAuth token の暗号化
├── services/
│   └── googleSheetsClient.ts # Google Sheets API クライアント
└── http/
    └── response.ts          # HTTPレスポンスヘルパー
```

## セキュリティ

- すべてのエンドポイントでSupabase JWTによる認証が必要
- Google OAuth stateはHMAC署名し、10分で期限切れにする
- Google OAuth トークンはAES-GCMで暗号化してSupabaseに保存
- 既存の平文token行は移行期間中のみ読み取り互換を残し、再連携またはtoken refresh時に暗号化形式へ更新する
- Row Level Security (RLS) によるデータアクセス制御
- WorkerはService RoleでSupabase RESTを呼ぶため、request bodyの`user_id`を信用せず、検証済みJWTのuser idだけを永続化に使う
- CORSは `https://forge.h031203yama.workers.dev` とローカル開発originに限定し、未知originは既定originへフォールバックする
- シークレット情報は環境変数として管理（コードに含めない）

## 詳細なセットアップ手順

プロジェクトルートの `docs/specs/google-sheets-integration/quickstart.md` を参照してください。
