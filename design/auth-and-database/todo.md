# 認証・データ永続化 TODO

最終更新: 2025-09-25

## 実装タスク
- [ ] Supabase 向けデータソース実装
  - [ ] 認証済みユーザーの JWT 検証
  - [x] `sessions` テーブルへの CRUD 実装
  - [ ] Row Level Security ポリシー設定
- [ ] TanStack Query と Supabase の同期
  - [x] セッション一覧取得とキャッシュ無効化
  - [x] 走行状態 (running state) の永続化
- [ ] 環境変数と設定
  - [ ] `VITE_TIME_DATA_SOURCE` 切替動作の確認
  - [ ] Supabase URL / anon key の Secrets 化

## テスト / QA
- [ ] Supabase データソースを利用した E2E テスト追加
- [ ] ローカルストレージ → Supabase 切り替え時の回帰リグレッションテスト

## ドキュメント整備
- [ ] `prototype/<branch>/README.md` に Supabase 利用手順を追記
- [ ] `docs/adr` にデータソース抽象と TanStack Query 導入背景を記載
