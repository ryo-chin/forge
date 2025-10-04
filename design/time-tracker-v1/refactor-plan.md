# フェーズ8 リファクタ計画

## 優先度順のタスクグルーピング

1. **基盤の準備**
   - `app/infra/`, `app/hooks/`, `app/hooks/data/`, `app/lib/`, `app/ui/`, `app/features/time-tracker/` のディレクトリ雛形を作成。
   - `tsconfig.json`, `vite.config.ts`, `vitest.config.ts` のパスエイリアス更新。

2. **データアクセスレイヤーの分離**
   - LocalStorage / API 呼び出しを `app/infra/localstorage/`, `app/infra/api/` へ移設。
   - `hooks/data/useTimeTrackerSessions` (仮) を作成し、`TimeTrackerRoot` から永続化処理を切り離す。

3. **共通ロジックの切り出し**
   - 共有カスタムフックを `app/hooks/` へ、純粋関数を `app/lib/` へ移す。
   - ドメイン関数（セッションパース、フォーマッタ等）を `app/features/time-tracker/domain/` に配置。

4. **UI コンポーネント 分割**
   - `TimeTrackerRoot` 内の UI を `Composer`, `HistoryList`, `EditorModal` などへ分割。
   - 各コンポーネントのロジックを `*.hooks.ts` として切り出し、 props で橋渡しする構造へ変更。
   - コンポーネント間で受け渡す情報は最小限になるようにロジックのの見直しも検討する。

5. **ページ層とルーティング**
   - `app/features/time-tracker/pages/TimeTrackerRoot.tsx`（仮）を作成し、データ取得と子コンポーネントの組み合わせを担当。
   - `app/src/main.tsx` 側のルーティング設定を更新。

6. **依存関係検証とテスト**
   - import パスを整理し、`infra -> hooks/data -> features` の流れを確認。
   - `npm run lint`, `npm run test:unit`, `npm run build` を回して循環依存や型エラーを検証。

## 依存関係
- (1) を完了してから (2) 以降の移設に着手する。
- (2) の `hooks/data` が整った後に (4) の 分離を進めると副作用管理が安定。
- (3) のドメイン整理は (2)(4) と並行でも良いが、共通関数の参照先が変わるため (2) の後に行う。
- (5) は UI 分割 (4) の後に実施すると props 構造の整理がスムーズ。
- (6) は各ステップ後に部分的に実施し、最終的にまとめてチェックする。

## メモ
- 既存テストのパスや import も段階的に更新する必要がある。
- 変更毎に `design/time-tracker-v1/todo.md` を更新し、フェーズ8の進捗を追跡する。
