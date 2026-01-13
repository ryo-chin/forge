# Worktreeクリーンアップ

不要なworktreeを検出して削除する。

## 手順

1. `git worktree list` で現在のworktreeを一覧表示
2. `.worktrees/` 配下の各worktreeについて:
   - PR番号が含まれる場合（pr-45など）→ `gh pr view` でPR状態を確認
   - Issue番号が含まれる場合（issue-42-v1など）→ ブランチ名からPRを検索
3. マージ済み/クローズ済みのworktreeを削除対象としてリストアップ
4. ユーザーに確認後、`git worktree remove <path> --force` で削除
5. 最後に `git worktree prune` を実行
