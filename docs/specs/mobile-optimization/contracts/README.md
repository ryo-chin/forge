# Contracts

本機能では新規 API / GraphQL エンドポイントの追加は行わず、既存のローカルストレージと Google スプレッドシート同期フローを流用する。UI レイヤーでのイベント契約を以下に整理する。

## UI Event Contracts

| User Action | Trigger | Expected Data Flow | Side Effects |
|-------------|---------|-------------------|--------------|
| タイマー開始 | `Composer` の開始ボタン | `start(title)` を呼び出し `RunningSessionState` を `running` に遷移 | ハンバーガー状態が開いている場合は自動で閉じない |
| タイマー停止 | 停止ボタン | `stop()` → `persistSessions` → `syncSession` | 成功後に `undoState` をクリア、ハンバーガー状態は保持 |
| メニュー展開 | ハンバーガーアイコン | `setMenuOpen(true)` + body `overflow: hidden` | オーバーレイ表示、背面操作無効 |
| メニュー閉じる | オーバーレイ背景タップ or 閉じるアイコン or メニュー項目選択 | `setMenuOpen(false)` + body `overflow` 復元 | 選択項目に応じて既存ルーティングを起動 |
| 履歴編集保存 | 編集モーダルの保存 | `buildUpdatedSession` → `persistSessions` → optional `syncSession` | モーダルを閉じ、履歴リストを再描画 |
| 履歴削除 → 元に戻す | 履歴行アクション | `setUndoState` を経由し表示更新 | `undoState` が消費されるまでメニュー開閉には影響なし |

## External Dependencies
- `useTimeTrackerSessions`, `useRunningSession`: API 変更なし。
- `useGoogleSpreadsheetSync`, `useGoogleSpreadsheetOptions`: UI 改修のみで利用方法は現状維持。

この契約を満たす範囲で UI 実装およびテストケースを作成する。
