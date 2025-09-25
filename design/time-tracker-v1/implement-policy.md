# タイムトラッカーMVP実装方針

## 開発前提
- `app-by-codex/` をアプリケーションルートとして扱い、タイムトラッカーは機能モジュールとして `app-by-codex/features/time-tracker/` 配下に構築する。共通リソースは将来の他機能と共有できるよう `app-by-codex/shared/` 等へ分離する。
- Vite + React + TypeScript を基本構成とし、Cloudflare Workers 静的配信を前提に `npm install` / `npm run build` で成果物を生成できる状態を維持する。
- セッションモデルは `Session { id, title, startedAt, endedAt, durationSeconds, tags, skill, project, intensity, notes }` を核に、進行中の編集を扱う `SessionDraft` と永続履歴を分離する。
- 状態管理は `useReducer` + Context を軸にし、主要UIは「即時スタート入力バー + 折り畳み式詳細編集」を中心に構成する。

## フェーズ別進行と検証
1. **プロジェクト雛形 & 品質基盤**
   - `app-by-codex/features/time-tracker/` にViteテンプレートを配置し、共通設定ファイルはルートもしくは `app-by-codex/shared/config/` で管理。
   - ESLint・Prettier・Vitest・Testing Library・Playwright を導入し、`npm run lint` / `npm run test:unit` / `npm run test:e2e` のダミー実行と `npm run build` 完走を確認。
2. **ドメイン層の整備**
   - セッション・ドラフト関連の型と reducer を実装、タイマー計測ロジックを `useRunningSession` フックにまとめる。
   - 主要ロジックに対する単体テスト（タイマー更新・開始/停止・ドラフト変換）を作成し、CI実行を検証。
3. **即時スタート体験**
   - 入力フィールドから Enter/ボタンで 1 秒以内にセッションが開始される UI を実装。
   - 手動確認 + UI コンポーネントテストで、空入力が防止されることとタイマーリセット挙動を検証。
4. **進行中セッション編集**
   - タイトル/タグ/プロジェクト編集 UI（インライン＋折り畳み詳細）を追加し、ドラフトに反映。
   - 編集結果が停止後の履歴レコードへ反映されることをユニット＋コンポーネントテストで確認。
5. **開始時刻調整**
   - クイックナッジ（±5/±10分）ボタンとスクラバー UI を実装し、負の時間を防ぐガードを追加。
   - ナッジ連続操作時の補正ロジックを単体テストし、Playwright で基本操作を確認。
6. **履歴・再編集フロー**
   - 履歴一覧の表示、再編集モーダル（タグ・メモ編集）、削除/Undo を実装。
   - 連続記録時の集計と再編集が描画に反映されることをE2Eで検証。
7. **永続化と復元**
   - 進行中セッションと履歴を `localStorage` に保存し、リロード復元を実装。
   - 時刻差分復元とデータ移行テスト（モックストレージ）を追加。
8. **サジェスト・レポート**
   - 最近のタイトル/タグ/プロジェクトを候補表示し、キーボード操作で選択可能にする。
   - 日別集計ウィジェットとCSVエクスポートを実装し、データ生成テストを追加。
9. **仕上げ（アクセシビリティ・品質保証）**
   - `aria-*` 属性・フォーカス制御・Undo操作を強化し、負荷ポイントでのパフォーマンステストを実施。
   - `npm run lint && npm run test:unit && npm run test:e2e && npm run build` を最終チェックとして手動実行。

## テスト戦略
- **ユニットテスト**: Vitest + Testing Library。リデューサ、タイマー計算、フォーマッタ、永続化ラッパーなど副作用の少ないロジックをカバー。フェーズ2以降継続的に追加し、回帰防止の土台を早期構築。
- **コンポーネントテスト**: Testing Library で入力バー、編集パネル、履歴カードなど主要UIの相互作用を検証。状態更新とARIA属性をチェック。
- **E2Eテスト**: Playwright を用意し、即時スタート→停止→再編集→エクスポートのハッピーパスを段階的に拡張。重要フローのスナップショット比較で不意のUI崩れを検出。
- **CI想定**: `npm run test` でユニット/コンポーネント、`npm run test:e2e` でヘッドレスE2Eを実行し、GitHub Actions でも同一スクリプトを使う。テストデータはモックストレージで隔離し、副作用を閉じ込める。
- **パフォーマンス観点**: タイマー更新は requestAnimationFrame を避け1秒間隔で更新、重たい処理はWeb Worker化を検討。長時間計測時のドリフト検証をユニットテストで実施。

## 運用メモ
- Wrangler 設定は `wrangler.toml` にプレースホルダ名を置き、デプロイ時に `--name ${SANITIZED_BRANCH}` で上書き可能にする。
- 作業ブランチは `prototype/time-tracker/<phase>` のように `prototype` を含めた命名とし、`app-by-codex/features/time-tracker/` 内の変更に限定する。
- フェーズ完了ごとにスクリーンショットとテスト結果を記録し、将来の他機能追加やリファクタリング時に参照できるよう `docs/` 配下にADRを追加検討する。
