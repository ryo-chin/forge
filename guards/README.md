# Guards - ガードレール設計思想

このディレクトリは、AI駆動開発における**司法（ガードレール）**の設計思想を文書化します。

## 基本原則

### 1. 司法がSSOT（Single Source of Truth）

- ドキュメント（docs/）は司法の「人間向け表現」にすぎない
- 一次情報は常にガードレール（テスト、Lint、型定義）である
- docsにしか存在しない情報は本来あってはならない

### 2. 司法の2種類

#### 細則主義（0/1判定）

静的・定量・冪等な検証。機械的に判定可能。

| 対象 | SSOT | ツール |
|-----|------|--------|
| 機能仕様 | `app/tests/e2e/specs/` | Playwright |
| 型安全性 | `tsconfig.json` + `*.ts` | TypeScript |
| コード品質 | `biome.json` | Biome |
| アーキテクチャ境界 | `.eslintrc.cjs` | ESLint |
| API契約 | `domain/contracts.ts` | TypeScript |

#### 原則主義（スコア判定）

動的・定性・非冪等な検証。LLMによるスコア判定。

| 対象 | SSOT | 閾値 |
|-----|------|------|
| 命名の妥当性 | `guards/judge/criteria/naming.yml` | 9-10: PASS, 8-9: WARN, <8: FAIL |
| UXの自然さ | `guards/judge/criteria/ux.yml` | 同上 |
| 責務分割 | `guards/judge/criteria/responsibility.yml` | 同上 |

### 3. 情報の流れ

```
意図（Issue/RFC）
       ↓
司法（SSOT） ←── 失敗を観測して追加・改善
  ├── 細則主義: biome.json, .eslintrc.cjs, E2Eテスト, 型定義
  └── 原則主義: guards/judge/criteria/*.yml
       ↓
行政（AI実装） ←── 司法に照らして自己チェック・自律修復
       ↓
docs/（人間向け説明） ←── 司法から生成可能な二次情報
```

## ディレクトリ構成（将来）

```
guards/
├── README.md              # この文書
└── judge/                 # 原則主義（LLM Judge）
    ├── criteria/          # 評価基準YAML
    │   ├── naming.yml
    │   ├── ux.yml
    │   └── responsibility.yml
    └── thresholds.yml     # スコア閾値
```

## 参考資料

- [AI駆動開発フェーズモデル](../.claude/.local/AI駆動開発の発達段階.md)
- [AI駆動業務における生産性100x化](../.claude/.local/AI駆動業務における生産性100x化.md)
- [縦と横のガードレール](https://note.com/hideyuki_toyama/n/n24fd932811f5)

## 関連設計

- [ナレッジベース・コンテキスト構築 設計ドキュメント](../docs/design/knowledge-base-context-design.md)
