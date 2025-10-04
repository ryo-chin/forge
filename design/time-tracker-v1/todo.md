# todo

## フェーズ1: プロジェクト雛形
- [x] `app-by-codex/features/time-tracker/` ディレクトリを作成しVite + React + TSを初期化
- [x] 共有設定や共通スクリプトは `app-by-codex/shared/` 等に配置しつつ、ESLint / Prettier / Vitest / Testing Library / Playwright をセットアップ
- [x] `npm run lint && npm run test:unit && npm run test:e2e && npm run build` が成功することを確認

## フェーズ2: ドメインとタイマー基盤
- [x] セッション/ドラフト用の型と reducer、`useRunningSession` フックを実装
- [x] タイマー・ドラフト変換ロジックのユニットテストを追加

## フェーズ3: 即時スタートUI
- [x] 入力フィールド + スタート/ストップボタンのUIと挙動を実装
- [x] 空入力バリデーションとタイマー開始のコンポーネントテストを追加

## フェーズ4: 進行中セッション編集
- [x] タイトル/プロジェクト編集UIを追加しドラフトに反映
- [x] 停止時に履歴へ反映されることをユニット+コンポーネントテストで確認

## フェーズ5: 開始時刻調整
- [x] クイックナッジボタンで作業時間を補正
- [x] 連続ナッジ時の計算ガードをユニットテストで担保

## フェーズ6: 履歴・永続化
- [x] 履歴一覧、再編集モーダル、Undo操作を実装
- [x] 進行中/履歴データの `localStorage` 永続化と復元を実装しテスト

## フェーズ7: 品質仕上げ
- [x] アクセシビリティ改善（ARIA/フォーカス）とパフォーマンス検証
  - [x] モーダル表示時にアクティブ要素を記録してタイトル入力へ自動フォーカスし、閉じる際に元の要素へ戻すフックを追加しました。詳細編集モーダルへの role="dialog" 付与や Escape クローズも 含めてアクセシビリティを強化しています。app-by-codex/features/time-tracker/src/TimeTrackerPage.tsx:189-255
  - [x] タブ移動がモーダル外へ抜けないようフォーカストラップ処理を追加し、tabIndex=-1 のコンテナで初期フォーカスを受け止めるようにしました。app-by-codex/features/time-tracker/src/ TimeTrackerPage.tsx:546-570
  - [x] 上記挙動を担保するため、モーダルを開いた直後にタイトル入力へフォーカスが移ることと、閉じた際にトリガーボタンへ戻ることを確認するテストを追加しました。app-by-codex/features/time- tracker/src/TimeTrackerPage.test.tsx:117-159
  - [x] 次フェーズ検討用に v2 アイデアメモを作成し、最近のタスク/プロジェクトサジェスト案を整理しました。design/time-tracker-v2/idea.md:1-13
  - [x] プロジェクト用ポップオーバーで閉じた際にトリガーボタンへフォーカスが戻るよう useEffect を追加し、開閉状態を追跡するリファレンスを導入しました。app-by-codex/features/time- tracker/src/TimeTrackerPage.tsx:187-206, 282-306
  - [x] ポップオーバー内に aria-modal と tabIndex=-1 を設定し、Tab/Shift+Tab 操作が内部で循環するフォーカストラップ処理を実装しました。これによりキーボード操作のみでも確実に選択・決定で きます。app-by-codex/features/time-tracker/src/TimeTrackerPage.tsx:309-353, 641-675
  - [x] メニューを閉じた際のフォーカス戻しやフォーカストラップの挙動を検証するテストケースを追加し、既存のユニットテストと合わせて実行しました。app-by-codex/features/time-tracker/src/ TimeTrackerPage.test.tsx:179-232
  - [x] 履歴リストやナッジボタンのARIA属性を見直し、スクリーンリーダーでの説明強化を図る
    - [x] ランニングタイマーを `time-tracker-running-timer` として識別子付与し、ナッジグループに `aria-describedby` と経過時間を明示する個別ラベルを追加しました。app/features/time-tracker/src/TimeTrackerPage.tsx:151-179, 843-888
    - [x] 履歴項目ごとに視覚非表示テキストで詳細説明を補完し、編集/削除ボタンが対象セッション名を読み上げるよう `aria-label` を拡張しました。app/features/time-tracker/src/TimeTrackerPage.tsx:906-944
  - [x] 新しいアクセシブルネームと説明の存在を確認するユニットテストを追加し、`aria-describedby` の結び付きを検証しました。app/features/time-tracker/src/TimeTrackerPage.test.tsx:67-211

## フェーズ8: アーキテクチャ再編とディレクトリ整備
### 差分整理と優先度付け
- [x] `app/IMPLEMENTS.md` と現行コードの差分レポートを作成し、移行対象（ディレクトリ・モジュール・依存関係）を一覧化する (design/time-tracker-v1/diff-app-implements.md)
- [x] 一覧を基にフェーズ8タスクの優先度と依存関係を定義し、必要に応じてサブタスクへブレイクダウンする (design/time-tracker-v1/refactor-plan.md)

### 基盤整備と移行
- [x] `app/infra/`, `app/hooks/`, `app/hooks/data/`, `app/lib/`, `app/ui/`, `app/features/time-tracker/` など共通ディレクトリの雛形を作成し、TS/Vite のパス解決を更新する (tsconfig.json, vite.config.ts, vitest.config.ts)
- [x] 既存の API・ローカルストレージ連携を `app/infra/api/` と `app/infra/localstorage/` へ移設し、利用箇所を `hooks/data` 経由に差し替える (app/infra/localstorage/timeTrackerStorage.ts, app/features/time-tracker/hooks/data/useTimeTrackerStorage.ts)
- [x] 共有カスタムフックとユーティリティを `app/lib/` に集約し、重複処理の削減とテスト配置を整備する (app/lib/accessibility/focus.ts で trapTabFocus を共通化)
- [ ] 再利用可能な UI コンポーネントを `app/ui/` 配下へ抽出し、スタイルトークンやストーリーの参照先を更新する
- [x] `app/features/time-tracker/` 配下をコンポーネント単位のディレクトリに再編し、`Composer`・`HistoryList`・`EditorModal` のような UI を切り出す (app/features/time-tracker/components/{Composer,HistoryList,EditorModal}/)
- [x] `Composer` のロジックをコンポーネント内部の hook へまとめ直し、親から渡すデータ/イベントを最小限に整理する (app/features/time-tracker/components/Composer/*, app/features/time-tracker/src/TimeTrackerPage.tsx)
- [ ] 各コンポーネントごとに `*.hooks.ts` を導入し、ハンドラや状態計算を分離する（例: `Composer.hooks.ts` で start/stop などを集約）
- [ ] ドメインロジック（セッションパーサーやフォーマッタ等）を `app/features/time-tracker/domain/` に整理し、副作用を持たない関数へ統一する
- [ ] タイムトラッカー固有のデータ取得フックを `app/features/time-tracker/hooks/data/` に実装し、ローカルストレージや API 呼び出しを `hooks/data` 経由へ集約する
- [ ] ルーティング/ページエントリを `app/features/time-tracker/pages/` に配置し、子コンポーネントへの props 受け渡しを確認する
- [x] 依存関係図に沿って import を見直し、循環や暗黙依存が無いことを CI（lint / tsc）で検証する (app/.eslintrc.cjs に import/no-internal-modules ルールを追加し、components配下は index.ts 経由のみ許可)

## フェーズ9: 最終確認とリリース準備
- [ ] 主要ユースケースを手動確認しつつ、リファクタで追加した README やドキュメントを更新する
- [ ] `npm run lint && npm run test:unit && npm run test:e2e && npm run build` を実行して全テストスイートを確認する
- [ ] リリースチェックリストを最新化し、残タスクとリスクをレビューする
- [ ] `serena` の `coding_guidelines` メモリを新しいディレクトリ構成（`app/ui`, `app/hooks` など）に合わせて更新する
