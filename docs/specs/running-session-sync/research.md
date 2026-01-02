# Research: Running Session同期機能

**Feature**: 004-running-session-running
**Date**: 2025-10-19
**Phase**: Phase 0 - Outline & Research

## Overview

Running中のセッション状態を複数デバイス間で同期し、Google Sheetsにもリアルタイムに反映する機能を実装するための技術調査。既存の実装を最大限活用し、必要最小限の拡張に留める。

## Research Areas

### 1. 既存のSupabase Running State同期実装

**調査項目**: `time_tracker_running_states`テーブルと`supabaseDataSource`の実装状況

**現状確認**:
- ✅ `app/src/infra/repository/TimeTracker/supabaseDataSource.ts` に既に実装済み
- ✅ `fetchRunningState()`: Running状態をSupabaseから取得
- ✅ `persistRunningState()`: Running状態をSupabaseに保存
- ✅ `useRunningSession`フックが既に同期ロジックを実装
  - マウント時にサーバーから状態を取得
  - 状態変更時にサーバーに永続化
  - シグネチャベースの差分検出で不要な同期を回避

**Decision**: 既存実装をそのまま利用。P1（デバイス間同期）は既に実装されているため、テスト追加と動作検証のみで完了可能。

**Rationale**:
- `time_tracker_running_states`テーブルは既に存在し、user_id, status, draft, elapsed_secondsを保存
- `useRunningSession`は既にマウント時のfetch、編集時のpersistを実装済み
- Last Write Winsパターンも既に実装（サーバーの状態で上書き）

**Alternatives considered**:
- リアルタイム同期（Supabase Realtime）: Assumptionsで手動リロードと明記されているため不採用
- ポーリング: 不要な負荷を避けるため不採用

---

### 2. Google Sheets API でのRunning状態同期パターン

**調査項目**: 既存のGoogle Sheets同期実装を拡張し、Running状態を扱う方法

**現状確認**:
- ✅ `app/src/infra/google/googleSyncClient.ts` に既存実装あり
- ✅ `useGoogleSpreadsheetSync` フックで完了セッションの同期を実装
- ✅ Column mappingの仕組みあり（`ColumnMappingForm`コンポーネント）

**Decision**: 以下のアプローチでRunning状態をGoogle Sheetsに同期

1. **Running行の識別**:
   - 専用の「Status」列を追加（既存の列マッピングに追加）
   - 値: "Running" | "Completed"
   - Running状態のIDを内部的に保持（隠し列またはメタデータ）

2. **同期タイミング**:
   - セッション開始時: 新しい行を追加、Status="Running"
   - セッション編集時: 該当行を更新（タイトル、プロジェクト、タグ等）
   - セッション停止時: Status="Completed"に変更、終了時刻・合計時間を確定
   - アプリリロード時: Running行の経過時間を更新

3. **API呼び出し制限対策**:
   - 編集時の更新は即座に行わず、debounce（1秒）を適用
   - 経過時間の更新は手動リロード時のみ（自動ポーリングなし）
   - バッチ更新API（`spreadsheets.values.batchUpdate`）を使用

**Rationale**:
- 既存のGoogle Sheets同期パターンを踏襲し、学習コストを最小化
- Status列の追加により、Running/Completed状態を明示的に管理
- API制限（100リクエスト/分）を考慮したdebounce実装

**Alternatives considered**:
- 別シートでRunning状態を管理: ユーザー体験が分断されるため不採用
- リアルタイムポーリング: API制限に抵触するリスクが高いため不採用
- Running行を削除して完了時に再追加: 行IDの管理が複雑になるため不採用

---

### 3. Running Session ID の管理方法

**調査項目**: Running中のセッションをGoogle Sheets上で一意に識別する方法

**Decision**: 以下の2つのアプローチを組み合わせる

1. **一時ID（クライアント生成）**:
   - セッション開始時に`crypto.randomUUID()`で生成
   - `SessionDraft`に`tempId`フィールドを追加（既存のidは停止時に生成）
   - Google Sheetsの隠し列または特定列に保存

2. **行番号ベースの検索**:
   - Running状態の行は常に最新行または特定範囲内に存在
   - Status="Running"かつuser_idまたはtempIdでフィルタ

**Rationale**:
- 停止前のセッションには確定IDがないため、一時IDが必要
- Google Sheets APIは行番号で更新できるため、tempIdで検索→行番号取得→更新の流れ

**Alternatives considered**:
- セッション開始時に確定IDを生成: 既存のID生成ロジック（停止時に生成）を変更する必要があり、影響範囲が広いため不採用
- タイムスタンプのみで識別: 複数デバイスで同時開始した場合の競合リスクがあるため不採用

---

### 4. オフライン時の動作とエラーハンドリング

**調査項目**: ネットワークエラー時の振る舞いとリトライ戦略

**Decision**:
- **Supabase同期**: ネットワークエラー時はcatchブロックでエラーログ出力のみ、自動リトライなし
- **Google Sheets同期**: 同様にエラーログ出力、ベストエフォート
- **ローカルストレージ**: オフライン時もローカルで計測継続（既存実装）
- **ユーザー操作**: 手動リロードで同期再試行

**Rationale**:
- Assumptionsで「自動リトライなし、手動アクションで再開」と明記
- ローカルタイムトラッカー機能はオフライン時も動作（FR-004, SC-006）
- エラー通知はコンソールログレベル（ユーザーへのトーストは不要）

**Alternatives considered**:
- 指数バックオフでの自動リトライ: Assumptionsで明示的に除外されているため不採用
- オフラインキュー: 実装の複雑性が増すため不採用

---

### 5. テスト戦略

**調査項目**: P1, P2の独立テスト方法とE2Eシナリオ

**Decision**:

**ユニットテスト**:
- `useRunningSession`: 既存テストを拡張し、Supabase同期の動作を検証
- `googleSyncClient`: Running状態のappendRow, updateRow, updateStatusのテスト追加

**コンポーネントテスト**:
- `useGoogleSpreadsheetSync`: モックされたGoogle APIクライアントでRunning同期をテスト

**E2Eテスト**:
- シナリオ1: デバイスAでセッション開始→デバイスB（別ブラウザコンテキスト）でリロード→同じセッション表示
- シナリオ2: Google Sheets連携有効→セッション開始→Sheets APIモックで行追加を検証
- シナリオ3: セッション編集→Sheets APIモックで行更新を検証

**Rationale**:
- TDD原則に従い、テストを先に書く
- E2Eで複数デバイスシミュレーションはPlaywrightの複数コンテキスト機能を使用
- Google Sheets APIはモック（実際のAPIは使わない）

---

## Technology Decisions Summary

| 決定事項 | 選択 | 理由 |
|---------|------|------|
| Supabase同期方法 | 既存実装をそのまま利用 | 既に`time_tracker_running_states`対応済み |
| Google Sheets同期タイミング | 開始・編集（debounce 1秒）・停止・リロード | API制限を考慮したベストプラクティス |
| Running行の識別 | Status列 + tempId | 既存パターンを踏襲、シンプル |
| エラーハンドリング | ログ出力のみ、自動リトライなし | Assumptionsに準拠 |
| テスト | ユニット・コンポーネント・E2E | Constitution III準拠 |

## Implementation Impact

### 新規追加が必要なファイル
- なし（すべて既存ファイルの拡張）

### 変更が必要な既存ファイル
1. `app/src/features/time-tracker/hooks/data/useGoogleSpreadsheetSync.ts`: Running状態同期機能追加
2. `app/src/infra/google/googleSyncClient.ts`: Running行の追加・更新・ステータス変更メソッド追加
3. `app/src/features/time-tracker/domain/types.ts`: `SessionDraft`に`tempId?`追加（オプショナル）
4. テストファイル: 各機能のテスト追加

### データモデル変更
- Supabase: 変更なし（既存テーブルを使用）
- Google Sheets: Status列の追加（ユーザー設定で列マッピング）

## Next Steps

Phase 1で以下を作成:
1. **data-model.md**: `SessionDraft`へのtempId追加、Google Sheets Row構造
2. **contracts/**: Google Sheets API呼び出しインターフェース
3. **quickstart.md**: 開発者向けセットアップガイド
