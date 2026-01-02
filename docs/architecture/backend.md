# Backend Architecture (API Worker)

> このドキュメントは api/ の実装ガイドラインの「人間向け表現」です。
> SSoTは `api/src/` のコードと型定義、および `api/tests/` のテストです。

## 基本方針

- **クライアント→Worker→外部サービスの三層構造**を前提に、同期ロジックや資格情報の取り扱いは Worker 側に閉じ込める。ブラウザから直接外部 API を叩かず、HTTP エンドポイントを介する。
- **セッション ID を不変値として扱う**。Running 開始時に生成した ID を完了まで使い回し、完了時の同期も同じ ID 行を更新（アップサート）する。
- **列マッピングの解決は Worker 側で一元化**。列記号（A/B/C...）とヘッダー名のどちらにも対応するユーティリティを用意し、ハンドラー内で繰り返し書かない。
- **シートへ書き込む日時フォーマットはサービス全体で統一**（Time Tracker では `YYYY/MM/DD HH:mm:ss` の JST 表記）。Worker 内のユーティリティで整形する。
- **CORS/メソッド許可は実際の利用に合わせる**。PATCH / DELETE など新しい HTTP メソッドを扱う場合は `Access-Control-Allow-Methods` を忘れず更新する。

## ディレクトリ構成

```
api/
├── src/
│   ├── auth/          # JWT 検証など認証関連
│   ├── handlers/      # 各エンドポイントのビジネスロジック
│   ├── repositories/  # Supabase へのデータアクセス
│   ├── services/      # 外部 API（Google Sheets など）クライアント
│   ├── utils/         # 汎用ユーティリティ（列解決、日時整形など）
│   ├── http/          # レスポンス生成ヘルパー
│   ├── env.ts         # 環境変数型定義
│   ├── index.ts       # エントリーポイント／ルーティング
│   └── types.ts       # 共通型定義
└── tests/
    └── handlers/**    # 各ハンドラーのユニットテスト
```

## ハンドラー設計

- **エンドポイントの責務はハンドラー単位で完結**させ、認証→接続情報の取得→ビジネスロジック→レスポンス生成の流れを一定にする。
- **`resolveConnectionContext` などの共通処理はヘルパー化**しておき、ハンドラーごとに同じ null チェックや例外処理を繰り返さない。
- **HTTP エラーは `HttpResponseError` のような例外で early return** し、ハンドラー末尾で一括キャッチ。レスポンス生成の分岐を最小化する。
- **Google Sheets の列解決は `resolveColumnLetter` で統一**。列記号が設定されていればそのまま使い、ヘッダー名の場合は 1 行目を読み取って列記号へ変換する。
- **アップサート挙動**：
  - Running 開始 (`/running/start`) では `appendRow` を呼ぶが、ヘッダー名を使う場合は列の順序を `buildRunningRowValues` で組み立ててから渡す。
  - Running 更新 (`/running/update`) では ID 列で行番号を探し、`batchUpdateValues` で該当セルだけを書き換える。
  - セッション完了 (`/sync`) では既存行が見つかれば更新、なければ新規行を追記する。

## Google Sheets 操作のルール

- **必ず `GoogleSheetsClient` を通して fetch を行う**。アクセストークンの付与、エラーハンドリングはサービス内で完結させる。
- **batchUpdate を用いる場合は `data: [{ range, values }]` の形で複数セルをまとめて更新**。単独セルの書き換えでも同じフォーマットに合わせる。
- **ヘッダー行を取得する場合は `sheetTitle!1:1` を読み、取得に失敗したら警告ログに留めて null で続行**（列記号指定のケースを優先）。

## テストポリシー

> 司法: `api/tests/handlers/` のユニットテスト

- **ハンドラーごとにユニットテストを用意**し、GoogleSheetsClient や Supabase リポジトリなど外部依存は vi.fn でモックする。
- **列解決・日時整形などのユーティリティはユニットテストでカバー**するか、呼び出し側のハンドラーで期待する結果を検証する。
- **E2E はフロント側 (`app/tests/e2e/`) でのみ実施し、Worker 側はユニットテストで担保**する。実際の Google API を叩くテストは導入しない。

## 実装上の注意

- **ID やプロジェクト等のフィールドはフロントで基本バリデーションを済ませる**。Worker は受け取った値を信頼しつつ、空欄などがあれば適切に null／空文字へ変換する。
- **日時フォーマットは Worker で共通化**。フロントは ISO / ミリ秒表記のまま送信し、Worker がシート表示用のフォーマットへ整形する。
- **レスポンスは JSON + 適切なステータスコードで返す**。成功時は 202 など非同期処理用、エラー時は 401/409 など意味のあるコードを使う。
- **CORS 設定は `http/response.ts` の `getCorsHeaders` に集約**し、新しい HTTP メソッドを扱う場合はここを更新する。

## 依存関係

- Cloudflare Workers Runtime
- Supabase REST API（Service Role）
- Google Sheets API v4
- Vitest / ESLint / TypeScript

## 開発時のチェックリスト

1. 新しい同期ロジックを追加する場合、ヘッダー名／列記号の両方で動作するかユーティリティを使って確認する。
2. Worker 経由の HTTP メソッドがブラウザから呼べるよう CORS 設定を更新する。
3. テストは `npm run test -- --run` で watch なし実行、lint は `npm run lint` で通す。
4. Supabase の RLS / OAuth まわりに変更がある場合は README だけでなくここにも反映させる。
