# 2025/10/05 time-tracker v1 残TODO
- [ ] 再利用可能な UI コンポーネントを `app/ui/` 配下へ抽出し、スタイルトークンやストーリーの参照先を更新する
- [ ] 各コンポーネントごとに `*.hooks.ts` を導入し、ハンドラや状態計算を分離する（例: `Composer.hooks.ts` で start/stop などを集約）
- [ ] ドメインロジック（セッションパーサーやフォーマッタ等）を `app/features/time-tracker/domain/` に整理し、副作用を持たない関数へ統一する
- [ ] タイムトラッカー固有のデータ取得フックを `app/features/time-tracker/hooks/data/` に実装し、ローカルストレージや API 呼び出しを `hooks/data` 経由へ集約する
- [ ] ルーティング/ページエントリを `app/features/time-tracker/pages/` に配置し、子コンポーネントへの props 受け渡しを確認する
