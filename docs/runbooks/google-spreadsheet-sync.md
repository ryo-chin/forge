# Google Spreadsheet Sync - 運用手順とリカバリガイド

## 概要

Time TrackerのセッションデータをGoogle Spreadsheetsに自動同期する機能の運用手順、トラブルシューティング、リカバリ方法をまとめたドキュメント。

## アーキテクチャ概要

```
[Time Tracker UI]
    ↓ セッション停止時
[Supabase] 保存
    ↓
[Google Sync Worker] OAuth認証・トークン管理
    ↓
[Google Sheets API] データ書き込み
```

### 主要コンポーネント

- **Frontend**: `app/features/time-tracker/`
  - セッション管理とGoogle同期UI
- **Worker**: `workers/google-sync/`
  - OAuth認証、トークンリフレッシュ、Sheets API連携
- **Database**: Supabase
  - `time_tracker_sessions`: セッションデータ
  - `google_spreadsheet_connections`: OAuth接続情報
  - `google_spreadsheet_column_mappings`: カラムマッピング
  - `google_sync_logs`: 同期ログ

---

## 日常運用

### 1. モニタリング

#### 同期成功率の確認

```sql
-- 過去24時間の同期成功率
SELECT
  status,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM google_sync_logs
WHERE attempted_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;
```

#### 失敗ログの確認

```sql
-- 最近の失敗ログを確認
SELECT
  id,
  session_id,
  failure_reason,
  attempted_at,
  retry_count
FROM google_sync_logs
WHERE status = 'failed'
  AND attempted_at >= NOW() - INTERVAL '7 days'
ORDER BY attempted_at DESC
LIMIT 20;
```

### 2. アクセストークンの管理

アクセストークンは1時間で期限切れとなりますが、自動的にリフレッシュされます。

#### トークン状態の確認

```sql
-- 期限切れトークンの確認
SELECT
  user_id,
  access_token_expires_at,
  status,
  updated_at
FROM google_spreadsheet_connections
WHERE access_token_expires_at < NOW()
  AND status = 'active';
```

期限切れトークンがある場合、次回の同期時に自動的にリフレッシュされます（5分前にプロアクティブリフレッシュ）。

---

## トラブルシューティング

### 問題1: 同期が失敗する

#### 症状
- UIに「同期エラー」バナーが表示される
- `google_sync_logs`に`status='failed'`レコードが記録される

#### 原因の特定

1. **同期ログを確認**
```sql
SELECT failure_reason
FROM google_sync_logs
WHERE session_id = '<対象session_id>'
ORDER BY attempted_at DESC
LIMIT 1;
```

2. **一般的なエラー原因**

| エラーメッセージ | 原因 | 対処法 |
|----------------|------|--------|
| `Bearer token is required` | 認証トークンが無効 | ユーザーに再ログインを依頼 |
| `connection_missing` | Google連携が未設定 | 設定ダイアログから連携設定 |
| `connection_inactive` | 連携が無効化されている | OAuth再認証 |
| `selection_missing` | スプレッドシート未選択 | 設定ダイアログから選択 |
| `Failed to refresh access token` | リフレッシュトークンが無効 | OAuth再認証 |
| `401 Unauthorized` | Google APIトークンエラー | OAuth再認証 |
| `403 Forbidden` | スプレッドシートへのアクセス権限なし | 権限確認またはシート再選択 |

#### 対処手順

**ステップ1: ユーザー側の対処**

1. Time Tracker画面の「⚙️ 設定」ボタンをクリック
2. 「Google アカウントと連携」を実行（必要に応じて）
3. スプレッドシートとシートを選択
4. セッションを停止して同期を再試行

**ステップ2: 管理者側の対処（ユーザー対処で解決しない場合）**

```sql
-- 接続状態を確認
SELECT * FROM google_spreadsheet_connections
WHERE user_id = '<対象user_id>';

-- 接続をリセット（最終手段）
UPDATE google_spreadsheet_connections
SET status = 'revoked'
WHERE user_id = '<対象user_id>';
```

その後、ユーザーに再度OAuth認証を依頼。

### 問題2: データが間違った列に入る

#### 症状
- スプレッドシートのデータが期待と異なる列に配置される

#### 原因
- カラムマッピングの設定ミス
- ヘッダー行が変更された

#### 対処手順

1. **現在のマッピングを確認**
```sql
SELECT mappings, required_columns, optional_columns
FROM google_spreadsheet_column_mappings
WHERE connection_id = (
  SELECT id FROM google_spreadsheet_connections
  WHERE user_id = '<対象user_id>'
);
```

2. **ユーザーに設定を確認してもらう**
- 設定ダイアログを開く
- カラムマッピングフォームで正しい列を指定
- 保存後、新しいセッションで検証

3. **スプレッドシートのヘッダー行を確認**
- ヘッダー名を使用している場合、1行目のヘッダーが正しいか確認
- 列記号（A, B, C...）を使用する方が確実

### 問題3: トークンリフレッシュの失敗

#### 症状
- `Failed to refresh access token`エラー
- 長期間使用していなかった場合に発生

#### 原因
- リフレッシュトークンが無効化された
- Google側でアクセスが取り消された

#### 対処手順

1. **接続状態を確認**
```sql
SELECT
  user_id,
  status,
  access_token_expires_at,
  updated_at
FROM google_spreadsheet_connections
WHERE user_id = '<対象user_id>';
```

2. **OAuth再認証**
- ユーザーに設定ダイアログから「Google アカウントと連携」を再実行してもらう
- 新しいアクセストークンとリフレッシュトークンが発行される

---

## リカバリ手順

### シナリオ1: 大量の同期失敗が発生した場合

**状況**: システム障害により複数ユーザーの同期が失敗

**リカバリ手順**:

1. **影響範囲の確認**
```sql
-- 失敗したセッションのリスト
SELECT
  gsl.session_id,
  gsl.failure_reason,
  gsl.attempted_at,
  gsc.user_id
FROM google_sync_logs gsl
JOIN google_spreadsheet_connections gsc ON gsl.connection_id = gsc.id
WHERE gsl.status = 'failed'
  AND gsl.attempted_at >= '<障害発生時刻>'
ORDER BY gsl.attempted_at;
```

2. **手動再同期スクリプトの実行**

現時点ではUI上の「再試行」ボタンを使用する必要があります。
将来的には管理者用の一括再同期スクリプトを用意することを推奨。

### シナリオ2: スプレッドシートを誤って削除した場合

**状況**: ユーザーがGoogle Drive上でスプレッドシートを削除

**リカバリ手順**:

1. **Google Driveのゴミ箱から復元**
- Google Driveのゴミ箱から該当スプレッドシートを復元
- スプレッドシートIDは変わらないため、設定変更は不要

2. **復元できない場合**
- 新しいスプレッドシートを作成
- 設定ダイアログから新しいスプレッドシートを選択
- 過去データの再同期が必要な場合は手動でエクスポート

### シナリオ3: データベースマイグレーション後の復旧

**状況**: DBマイグレーションでデータが消失または破損

**リカバリ手順**:

1. **バックアップから復元**
```sql
-- バックアップからテーブルを復元
-- （具体的なコマンドは環境依存）
```

2. **接続の整合性確認**
```sql
-- 孤立したマッピング・ログレコードの確認
SELECT * FROM google_spreadsheet_column_mappings
WHERE connection_id NOT IN (
  SELECT id FROM google_spreadsheet_connections
);

SELECT * FROM google_sync_logs
WHERE connection_id NOT IN (
  SELECT id FROM google_spreadsheet_connections
);
```

3. **不整合データのクリーンアップ**
```sql
-- 孤立レコードの削除
DELETE FROM google_spreadsheet_column_mappings
WHERE connection_id NOT IN (
  SELECT id FROM google_spreadsheet_connections
);

DELETE FROM google_sync_logs
WHERE connection_id NOT IN (
  SELECT id FROM google_spreadsheet_connections
);
```

---

## セキュリティとメンテナンス

### アクセストークンの保護

- アクセストークンとリフレッシュトークンはSupabaseに暗号化して保存
- 環境変数`SUPABASE_SERVICE_ROLE_KEY`を厳重に管理
- Cloudflare Workerの環境変数も適切に設定

### 定期メンテナンス

#### 月次

1. **古い同期ログのアーカイブ**
```sql
-- 90日以上前のログを削除
DELETE FROM google_sync_logs
WHERE attempted_at < NOW() - INTERVAL '90 days';
```

2. **非アクティブな接続のクリーンアップ**
```sql
-- 6ヶ月以上更新されていない接続を確認
SELECT user_id, updated_at, status
FROM google_spreadsheet_connections
WHERE updated_at < NOW() - INTERVAL '6 months';
```

#### 四半期

1. **OAuth認証フローの動作確認**
- テストユーザーで新規連携を試行
- トークンリフレッシュが正常に動作することを確認

2. **Google API制限の確認**
- Google Cloud ConsoleでAPI使用量を確認
- 制限に近づいている場合は追加のクォータをリクエスト

---

## エスカレーションパス

### レベル1: ユーザーサポート
- 設定ダイアログでの再設定
- OAuth再認証
- 同期の手動再試行

### レベル2: 開発者サポート
- データベースログの確認
- 接続状態の手動リセット
- Workerログの調査

### レベル3: システム管理者
- Google Cloud Console での API 制限確認
- Supabase インフラの確認
- Cloudflare Workers の監視とログ

---

## 関連ドキュメント

- [Quickstart Guide](../specs/google-sheets-integration/quickstart.md)
- [API仕様](../specs/google-sheets-integration/contracts/)
- [データモデル](../specs/google-sheets-integration/data-model.md)
