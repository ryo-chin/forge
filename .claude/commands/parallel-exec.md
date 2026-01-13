---
description: 複数Issueを依存順序に従って並列実行する
---

以下のワークフローに従って複数Issueを並列実行してください。

@.claude/skills/parallel-executor/SKILL.md

## 使用例

```
# 複数Issueを指定
/parallel-exec #42, #43, #44

# 親Issueから子を自動収集
/parallel-exec #39
```

対象: $ARGUMENTS
