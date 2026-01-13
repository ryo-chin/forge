---
name: parallel-executor
description: 複数Issueを依存グラフに従って並列実行する準備を行う。「並列実行」「複数Issue処理」「parallel」と言われた時に使用。worktree作成と実行スクリプト生成を行い、実際の実行は別ターミナルで行う。
---

# Parallel Executor

複数Issueを依存グラフに従って並列実行するための**準備**を行い、iTerm2で実行を開始する。

## 原則

- **Main Agentは準備と起動のみ**: worktree作成とiTerm2タブ起動に専念（コンテキスト節約）
- **実行は別セッション**: iTerm2の別タブで独立したClaude CLIセッションを起動
- **セッション継続可能**: 各worktreeで `claude -c` で継続可能
- **PR作成で完了判定**: `gh pr list` でPRの存在を確認
- **バージョン管理**: 同一Issueでも複数worktree作成可能（異なる方針での並列実装用）

## ワークフロー

### Step 1: 対象Issue収集

ユーザーから実行対象Issueを受け取る。

```
#42, #43, #44
```

AskUserQuestionで実行対象を確認。

### Step 2: 依存グラフ解析

各IssueをGitHub CLIで取得し、依存関係を抽出。

```bash
gh issue view 42 --json number,title,body,state
```

パターンマッチ:
- `depends-on: #<number>`
- `Blocked by: #<number>`

循環依存を検出した場合はエラー。

### Step 3: 実行計画生成

トポロジカルソートで実行順序を決定。

```
Level 0（並列実行可能）: #42, #43
Level 1（Level 0完了後）: #44
```

AskUserQuestionで実行計画を確認。

### Step 4: worktree作成

各Issueに対してworktreeを作成。

**バージョン番号の決定**:
```bash
# 既存worktreeを確認
ls .worktrees/ | grep "issue-42"
# issue-42-v1, issue-42-v2 が存在する場合 → issue-42-v3 を作成
```

**worktree作成**:
```bash
mkdir -p .worktrees/logs
git worktree add .worktrees/issue-42-v1 -b issue-42-v1 main
```

### Step 5: iTerm2でセッション起動

`scripts/iterm-open.sh` を使ってiTerm2でセッションを起動する。

**スクリプト使用法**:
```bash
# Usage: iterm-open.sh <mode> <directory> [command]
#   mode: tab | vsplit | hsplit

# 新しいタブで開く
./scripts/iterm-open.sh tab /path/to/.worktrees/issue-42-v1 "claude"

# 縦分割で開く（左右に分割）
./scripts/iterm-open.sh vsplit /path/to/.worktrees/issue-42-v1 "claude"

# 横分割で開く（上下に分割）
./scripts/iterm-open.sh hsplit /path/to/.worktrees/issue-42-v1 "claude"
```

**自律実行の場合**:
```bash
./scripts/iterm-open.sh vsplit .worktrees/issue-42-v1 \
  'claude --permission-mode bypassPermissions "Issue #42 を実装してください。質問せずに自律的に実装し、完了したらPRを作成してください。"'
```

**注意**: 対話モードで起動するため、各セッションは自律的に動作し、完了まで続く。

**並列度制御**: 最大3つまで同時起動。Level内で3つを超える場合は分割。

### Step 6: 完了後の案内

以下を出力して終了:

```
起動完了しました。

進捗確認:
  gh pr list --state open --json number,title,headRefName

セッション継続（修正が必要な場合）:
  cd .worktrees/issue-42-v1
  claude -c  # 最新セッションを継続

全完了後のマージ順序:
  1. Level 0: #42, #43 → mainにマージ
  2. Level 1: #44 → mainにrebase後マージ

クリーンアップ:
  git worktree remove .worktrees/issue-42-v1 --force
  git branch -D issue-42-v1  # ブランチも削除
  git worktree prune
```

## バージョン管理

同一Issueで複数のworktreeを作成可能:

```
.worktrees/
├── issue-42-v1/   # 方針A
├── issue-42-v2/   # 方針B（別アプローチ）
├── issue-43-v1/
└── logs/
```

用途:
- 異なる方針での並列実装
- 失敗時のリトライ
- A/Bテスト的な実装比較

## 無限ループ対策

1. **目視監視**: 各タブの出力を定期確認
2. **PR確認**: PR未作成 = 問題発生の可能性
3. **手動停止**: 問題があればCtrl+Cでセッション終了

## セッション継続

修正が必要な場合:

```bash
cd .worktrees/issue-42-v1
claude -c  # 最新セッションを継続
# または
claude     # 新規セッションで対話的に修正
```

## アンチパターン

- Main Agentで監視ループを回す（コンテキスト消費）
- feature-devのような重いスキルを並列で使う
- worktreeを `rm -rf` で削除する（`git worktree remove` を使う）
