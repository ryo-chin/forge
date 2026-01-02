# Research Log — Google Spreadsheet Integration

## Google Sheets API 呼び出し方式

- **Decision**: Cloudflare Workers から Google Sheets REST API を `fetch` で直接呼び出す
- **Rationale**: Workers ランタイムは Web 標準 API に最適化されており、`googleapis` などの Node 専用 SDK は TLS/HTTP モジュール依存のため動作しない。REST エンドポイントを直接叩けばバンドルサイズを抑えつつワーカーのコールドスタートを最小限にでき、認証ヘッダー／リクエスト構造も Google ドキュメント準拠のまま扱える。
- **Alternatives considered**:
  - Node 向け `googleapis` / `google-spreadsheet`: Cloudflare では未サポートの Node コアモジュールに依存し失敗する
  - Apps Script 経由でのプロキシ: セキュリティ管理やデプロイフローが二重になり、レスポンス制御が難しい

## OAuth トークン管理と安全な保管

- **Decision**: Supabase Auth でユーザー識別し、Cloudflare Worker を OAuth コールバック先として設定してトークン交換・保管を担当させる。Tokens は Supabase の専用テーブル（`google_spreadsheet_connections` 仮称）に暗号化カラムで保存し、Worker が Service Role Key 経由で読み書きする。
- **Rationale**: Frontend にクライアントシークレットを持たせずに済み、`access_type=offline` と `prompt=consent` を付与したコードフローで `refresh_token` を取得すると長期利用が可能。ワーカーに集約すればトークン更新と失効時の再認証誘導ロジックも一箇所で制御できる。
- **Alternatives considered**:
  - フロントエンドが Supabase セッションの `provider_token` を直接利用: トークンの寿命が短く更新保証がないため失敗リスクが高い
  - サービスアカウント共有: ユーザーごとのスプレッドシートへ書き込む要件を満たせず、ユーザー自身の Google アカウントとの紐付けができない

## Cloudflare ランタイムでの外部 API 呼び出し制約

- **Decision**: Worker では `fetch` + `URLSearchParams` を用いた標準 Web API 実装に限定し、リクエストは 10MB 未満・5 秒以内で完結するようタイムアウトとリトライポリシーを設計する。Wrangler `preview` を利用したローカル検証、Secrets でクライアント ID/Secret を管理する。
- **Rationale**: Workers では Node の `crypto`, `stream` などが制限されるため、軽量な `fetch` 実装が最も互換性が高い。Google OAuth トークンエンドポイントも `application/x-www-form-urlencoded` に対応しており、Workers の `fetch` で問題なく呼び出せる。
- **Alternatives considered**:
  - Supabase Edge Functions による実装: インフラが分散し、Cloudflare 側のデプロイフローと二重管理になる
  - Cloudflare Pages Functions: React アプリと同一リポジトリで管理できるが、既存ワーカー構成と干渉するため今回は Workers に一本化

## 同期処理のスケールと整合性

- **Decision**: 各セッション停止イベントは Worker API に対して idempotent なリクエスト（`sessionId` を一意キーとする）を送信し、Google Sheets には `append` + `valueInputOption=USER_ENTERED` で追記する。Supabase 側に `sync_logs` テーブルを用意して成功/失敗ステータスを保存し、リトライ時は未同期セッションを対象にする。
- **Rationale**: タイムトラッカーのスループットはユーザー単位で数分〜数時間に 1 イベント程度であり、1 行 append で十分。idempotency を確保すればネットワークエラー時の再送も安全で、ログを残すことでユーザー通知や手動再同期を実装しやすい。
- **Alternatives considered**:
  - バッチ同期で複数行を一括送信: 同期失敗時の切り分けが難しく、P1 要件の「停止ごとに即時同期」と矛盾する
  - Google Sheets API の `batchUpdate`: 柔軟だが JSON ペイロードが複雑で、列マッピングのシンプルさが損なわれる
