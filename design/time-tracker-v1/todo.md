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
  - [x] モーダル表示時にアクティブ要素を記録してタイトル入力へ自動フォーカスし、閉じる際に元の要素へ戻すフックを追加しました。詳細編集モーダルへの role="dialog" 付与や Escape クローズも 含めてアクセシビリティを強化しています。app-by-codex/features/time-tracker/src/TimeTrackerRoot.tsx:189-255
  - [x] タブ移動がモーダル外へ抜けないようフォーカストラップ処理を追加し、tabIndex=-1 のコンテナで初期フォーカスを受け止めるようにしました。app-by-codex/features/time-tracker/src/ TimeTrackerRoot.tsx:546-570
  - [x] 上記挙動を担保するため、モーダルを開いた直後にタイトル入力へフォーカスが移ることと、閉じた際にトリガーボタンへ戻ることを確認するテストを追加しました。app-by-codex/features/time- tracker/src/TimeTrackerRoot.test.tsx:117-159
  - [x] 次フェーズ検討用に v2 アイデアメモを作成し、最近のタスク/プロジェクトサジェスト案を整理しました。design/time-tracker-v2/idea.md:1-13
  - [x] プロジェクト用ポップオーバーで閉じた際にトリガーボタンへフォーカスが戻るよう useEffect を追加し、開閉状態を追跡するリファレンスを導入しました。app-by-codex/features/time- tracker/src/TimeTrackerRoot.tsx:187-206, 282-306
  - [x] ポップオーバー内に aria-modal と tabIndex=-1 を設定し、Tab/Shift+Tab 操作が内部で循環するフォーカストラップ処理を実装しました。これによりキーボード操作のみでも確実に選択・決定で きます。app-by-codex/features/time-tracker/src/TimeTrackerRoot.tsx:309-353, 641-675
  - [x] メニューを閉じた際のフォーカス戻しやフォーカストラップの挙動を検証するテストケースを追加し、既存のユニットテストと合わせて実行しました。app-by-codex/features/time-tracker/src/ TimeTrackerRoot.test.tsx:179-232
  - [x] 履歴リストやナッジボタンのARIA属性を見直し、スクリーンリーダーでの説明強化を図る
    - [x] ランニングタイマーを `time-tracker-running-timer` として識別子付与し、ナッジグループに `aria-describedby` と経過時間を明示する個別ラベルを追加しました。app/features/time-tracker/src/TimeTrackerRoot.tsx:151-179, 843-888
    - [x] 履歴項目ごとに視覚非表示テキストで詳細説明を補完し、編集/削除ボタンが対象セッション名を読み上げるよう `aria-label` を拡張しました。app/features/time-tracker/src/TimeTrackerRoot.tsx:906-944
    - [x] 新しいアクセシブルネームと説明の存在を確認するユニットテストを追加し、`aria-describedby` の結び付きを検証しました。app/features/time-tracker/src/TimeTrackerRoot.test.tsx:67-211
- [ ] 改めて実装を見直し適切な分割戦略を検討したうえで、適切な粒度にレイヤーとコンポーネントとロジックを分割する
- [ ] 全テストスイートを実行してリリースチェックリストを更新
