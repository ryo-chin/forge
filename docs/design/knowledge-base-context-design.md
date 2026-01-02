# ナレッジベース・コンテキスト構築 設計ドキュメント

**Issue**: #26
**Date**: 2026-01-02
**Status**: Draft (v2)

---

## 1. 目的と背景

### 1.1 Issue #26の要求

1. specs/ドキュメントの更新 - speckit コマンド参照の削除/書き換え
2. ナレッジベースの構築 - プロジェクト固有の知識を体系化
3. コンテキスト管理 - CLAUDE.mdとAGENTS.mdの統合

### 1.2 ユーザーの設計思想（docs/referencesより）

**Phase2: 自律駆動への移行**

> ガードレール（司法）が主語になる世界
> 行政（AI）が自律的に実装・修正を行い、人は「意図」と「司法の改正」に集中

**SSoTの原則**

> 司法（ガードレール）をSSOTへ
> 立法（ドキュメント）と司法（ガードレール）の乖離を問題視

**司法の2種類**

| 種類 | 特徴 | 例 | 判定方式 |
|-----|------|-----|---------|
| 細則主義 | 静的・定量・冪等 | Lint, 型, API契約, DDD境界 | **0/1判定** |
| 原則主義 | 動的・定性・非冪等 | UXの自然さ, 文脈整合, 命名の意味 | **LLMスコア判定** |

---

## 2. 設計原則

### 2.1 核心原則

1. **司法（ガードレール）が唯一のSSoT** - docs/は司法の「人間向け表現」にすぎない
2. **docsにしか存在しない情報は本来あってはならない** - 全ての情報は司法に由来する
3. **0/1判定を最優先** - 可能な限り決定論的なルールに落とす
4. **推奨より禁止から作る** - やってはいけないことを先に定義
5. **失敗→司法へ変換** - 失敗パターンは必ずガードレールに変換

### 2.2 情報の階層構造

```
┌─────────────────────────────────────────────┐
│ 意図（Intent）                               │
│ - Issue / RFC / 要求                         │
│ - 人間が定義する                              │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 司法（Judiciary）= 唯一のSSOT                 │
│ ┌───────────────────┐ ┌───────────────────┐ │
│ │ 細則主義（0/1）    │ │ 原則主義（スコア）│ │
│ │ - E2Eテスト        │ │ - LLM Judge      │ │
│ │ - 型定義           │ │   (guards/judge/)│ │
│ │ - Lint             │ │                   │ │
│ │ - API Contract     │ │                   │ │
│ └───────────────────┘ └───────────────────┘ │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 行政（Executive）                            │
│ - AI による実装                               │
│ - 司法に照らして自己チェック                   │
│ - 違反時は自律修復                            │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ docs/ = 司法の「人間向け表現」                 │
│ - 司法ルールの背景説明                         │
│ - 人間が理解しやすい形式への変換                │
│ - 一次情報ではない（司法から生成可能）          │
└─────────────────────────────────────────────┘
```

### 2.3 情報の分類と司法化

現在docs/やAGENTS.mdに存在する情報を、司法化可能かどうかで分類する:

| 情報の種類 | 司法化可能？ | 司法化の方法 | 残った場合のdocs/での扱い |
|-----------|-------------|-------------|-------------------------|
| アーキテクチャ境界 | ✅ 可能 | ESLint `import/no-internal-modules` | Lintルールの説明 |
| レイヤリング規約 | ✅ 可能 | ESLint カスタムルール | Lintルールの説明 |
| 機能仕様 | ✅ 可能 | E2Eテスト | テストコードが仕様 |
| API契約 | ✅ 可能 | TypeScript型 (`contracts.ts`) | TSDocが説明 |
| コード品質 | ✅ 可能 | Biome / ESLint | 設定ファイルが仕様 |
| 命名規約 | △ 部分的 | ESLint + LLM Judge | 細則→Lint、原則→Judge |
| UXの自然さ | △ 部分的 | LLM Judge | 評価基準YAMLが仕様 |
| 開発環境セットアップ | ❌ 不可能 | - | README.md（純粋なガイド） |
| デプロイ手順 | ❌ 不可能 | - | docs/guides/（純粋なガイド） |
| ADR（意思決定記録） | ❌ 不可能 | - | docs/adr/（歴史的記録） |

---

## 3. 具体的な設計

### 3.1 司法（SSOT）の配置

**原則**: 司法はコードベース内の複数の場所に分散して存在する。それぞれが一次情報。

```
/forge
│
├── 【司法: 細則主義】
│
├── biome.json                   # コード品質（フォーマット・基本lint）
├── .eslintrc.cjs                # アーキテクチャ境界・カスタムルール (※appにも)
│
├── app/
│   ├── .eslintrc.cjs            # フロントエンド固有のルール
│   ├── tsconfig.json            # 型安全性
│   ├── tests/e2e/               # 機能仕様 = E2Eテスト
│   │   └── specs/               # 【新規】仕様別テストスイート
│   │       ├── 001-time-tracker/
│   │       ├── 002-mobile-ui/
│   │       └── 004-running-session/
│   └── src/features/*/domain/
│       └── contracts.ts         # 【新規】API契約（型レベル）
│
├── api/
│   ├── tsconfig.json            # 型安全性
│   └── src/types.ts             # API型定義
│
├── 【司法: 原則主義】
│
├── guards/                      # 【新規】LLM Judge用
│   ├── README.md                # ガードレール設計思想
│   └── judge/
│       ├── criteria/            # 評価基準YAML
│       │   ├── naming.yml
│       │   ├── ux.yml
│       │   └── responsibility.yml
│       └── thresholds.yml       # スコア閾値
│
├── 【docs: 司法の人間向け表現】
│
├── docs/
│   ├── guides/                  # 純粋なHow-To（司法化不可能な情報）
│   │   ├── setup.md             # 開発環境セットアップ
│   │   └── deployment.md        # デプロイ手順
│   │
│   ├── architecture/            # Lintルール等の背景説明
│   │   ├── overview.md          # システム全体構成
│   │   ├── frontend.md          # eslintrc.cjsルールの説明
│   │   └── backend.md           # API設計の説明
│   │
│   ├── adr/                     # 歴史的記録（既存のまま）
│   │
│   └── references/              # 参考資料（既存）
│
├── 【削除・アーカイブ対象】
│
├── AGENTS.md                    # → 司法化 or docs/guides/へ
├── app/IMPLEMENTS.md            # → 司法化 or docs/architecture/へ
├── api/IMPLEMENTS.md            # → 司法化 or docs/architecture/へ
├── specs/                       # → E2Eテスト化後にアーカイブ
└── .serena/                     # → 削除
```

### 3.2 AGENTS.mdの司法化分析

現在のAGENTS.mdの内容を司法化可能かどうか分析:

| AGENTS.mdの内容 | 司法化 | 方法 |
|----------------|--------|------|
| 「日本語で回答」 | ❌ | AIへの指示（司法ではない）→ CLAUDE.md |
| `prototype/`内は独立 | ✅ | ESLint `import/no-internal-modules` |
| `docs/`配下参照 | ❌ | ガイダンス（司法ではない）→ CLAUDE.md |
| `app/README.md`確認 | ❌ | ガイダンス → CLAUDE.md |
| プロトタイプ実装ルール | △ | 一部はLint化可能、一部はガイド |
| 開発ツール（pnpm, Biome, ESLint） | ✅ | package.json + 設定ファイルが司法 |

**結論**: AGENTS.mdは大部分がガイダンスであり、司法化は限定的。
→ CLAUDE.mdに統合し、司法（Lint）で検証可能な部分のみLint化

### 3.3 ガードレールの詳細設計

#### 3.3.1 細則主義（0/1判定）

| カテゴリ | ツール | SSOT（一次情報） | 判定方式 |
|---------|--------|-----------------|----------|
| 機能仕様 | Playwright E2E | `app/tests/e2e/specs/` | テスト通過/失敗 |
| 型安全性 | TypeScript | `tsconfig.json` + `*.ts` | コンパイル通過/失敗 |
| コード品質 | Biome | `biome.json` | 違反なし/あり |
| アーキテクチャ | ESLint | `.eslintrc.cjs` | 違反なし/あり |
| API契約 | TypeScript | `domain/contracts.ts` | 型チェック通過/失敗 |

#### 3.3.2 原則主義（スコア判定）

| カテゴリ | 評価者 | SSOT（一次情報） | スコア閾値 |
|---------|--------|-----------------|-----------|
| 命名の妥当性 | LLM Judge | `guards/judge/criteria/naming.yml` | 9-10: PASS, 8-9: WARN, <8: FAIL |
| UXの自然さ | LLM Judge | `guards/judge/criteria/ux.yml` | 同上 |
| 責務分割 | LLM Judge | `guards/judge/criteria/responsibility.yml` | 同上 |

### 3.4 CLAUDE.mdの設計

CLAUDE.mdは「司法への参照」と「司法化不可能なAI指示」のみを含む:

```markdown
# 回答
- 常に日本語で回答してください

# 開発方針
このプロジェクトはPhase2: 自律駆動開発を目指しています。

## 司法（ガードレール）がSSOT

以下の司法に従って開発を行ってください。docsは司法の「人間向け表現」です。

### 細則主義（0/1判定）
| 対象 | 司法（SSOT） |
|-----|-------------|
| 機能仕様 | `app/tests/e2e/specs/` のE2Eテスト |
| 型契約 | `app/src/features/*/domain/contracts.ts` |
| アーキテクチャ境界 | `app/.eslintrc.cjs` |
| コード品質 | `biome.json` |

### 原則主義（スコア判定）
| 対象 | 司法（SSOT） |
|-----|-------------|
| 命名・責務分割・UX | `guards/judge/criteria/*.yml` |

## 参考（司法の人間向け表現）
- アーキテクチャ背景: `docs/architecture/`
- セットアップ手順: `docs/guides/`
- 意思決定記録: `docs/adr/`
```

---

## 4. 移行計画

### 4.1 Phase 1: 整理と司法化の準備（今回のスコープ）

**目標**: 不要なものを削除し、司法化への準備を整える

| タスク | 内容 | 観点 |
|--------|------|------|
| T1 | .serena/ディレクトリ削除 | 不要なもの削除 |
| T2 | specs/内のspeckit参照削除 | 不要な参照削除 |
| T3 | AGENTS.md削除 → CLAUDE.mdに統合 | AI指示の一元化 |
| T4 | app/IMPLEMENTS.md → docs/architecture/frontend.md | 人間向け説明の整理 |
| T5 | api/IMPLEMENTS.md → docs/architecture/backend.md | 人間向け説明の整理 |
| T6 | CLAUDE.md更新（司法への参照構造） | 司法優先の構造 |
| T7 | guards/README.md作成 | 設計思想の文書化 |

**Phase 1完了時の状態**:
- CLAUDE.md = AI向けの唯一のエントリーポイント
- 司法（Lint、テスト、型）が一次情報であることが明確
- docs/ = 司法の人間向け表現という位置づけが明確

### 4.2 Phase 2: 機能仕様の司法化（将来）

**目標**: specs/の機能仕様をE2Eテスト（司法）に変換

| タスク | 内容 | 司法化 |
|--------|------|--------|
| T8 | E2Eテストフィクスチャ整備 | 基盤 |
| T9 | 001-time-tracker → E2Eテスト | 機能仕様 → 司法 |
| T10 | 002-mobile-ui → E2Eテスト | 機能仕様 → 司法 |
| T11 | 004-running-session → E2Eテスト | 機能仕様 → 司法 |
| T12 | specs/_archive/へ移動 | 二次情報化 |

**Phase 2完了時の状態**:
- 機能仕様のSSOT = E2Eテスト
- specs/ = E2Eテストが失敗した時の人間向け説明（二次情報）

### 4.3 Phase 3: 原則主義の司法化（将来）

**目標**: LLM Judgeによる非決定論的評価の自動化

| タスク | 内容 | 司法化 |
|--------|------|--------|
| T13 | guards/judge/基盤構築 | CLI + 評価エンジン |
| T14 | 評価基準定義 | criteria/*.yml = 司法 |
| T15 | CI統合 | 自動検証 |

**Phase 3完了時の状態**:
- 命名・責務分割・UXのSSOT = guards/judge/criteria/*.yml
- スコア判定による自動検証がCIに組み込まれる

---

## 5. 未決定事項（要検討）

### 5.1 specs/ディレクトリの扱い

**現在の設計方針**: specs/は「機能仕様」であり、本来はE2Eテストとして司法化すべき

**段階的移行案**:
1. Phase 1: speckit参照のみ削除、specs/はそのまま
2. Phase 2: E2Eテスト化後、specs/_archive/へ移動
3. 将来: specs/は完全に削除（E2Eテストが唯一のSSOT）

### 5.2 IMPLEMENTS.mdの扱い

**現在の設計方針**: IMPLEMENTS.mdは「アーキテクチャ説明」であり、本来はLintルールとして司法化すべき

**議論点**:
- 既存のESLint `import/no-internal-modules` は一部を司法化している
- 全てをLint化するのは困難（例: 「レイヤリングの思想」は司法化しにくい）

**結論**: Lint化可能な部分は既に司法化されている。残りは人間向け説明としてdocs/architecture/に配置

### 5.3 guards/ディレクトリの必要性

**現在の設計方針**: guards/は原則主義（LLM Judge）専用

- 細則主義のSSOT: biome.json, .eslintrc.cjs, tsconfig.json（既存）
- 原則主義のSSOT: guards/judge/criteria/*.yml（新規）

**Phase 1では**: guards/README.mdのみ作成し、設計思想を文書化

---

## 6. 設計の要約

### 6.1 情報の流れ

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

### 6.2 縦と横の司法（将来の方向性）

参考: https://note.com/hideyuki_toyama/n/n24fd932811f5

**横のガードレール（非機能の憲法）**:
- アーキテクチャと責務の構造を定める
- 依存関係の方向性やロジックの配置場所を規定
- 長期的に破綻しない基盤を形成
- 例: ESLint `import/no-internal-modules`、レイヤリング規約

**縦のガードレール（機能検証）**:
- UX、UIロジック、ビジネスロジック、API契約の4層
- 司法AIが行政AIの実装が意図どおりかを確かめる基準
- 例: E2Eテスト、Storybook、ドメインUT

**Forgeプロジェクトでの適用案**:

| レイヤー | 横の司法（構造） | 縦の司法（検証） |
|---------|-----------------|-----------------|
| UX | デザインルール | Storybook VRT |
| UI | コンポーネント規約 | コンポーネントUT |
| Domain | レイヤリング規約 | ドメインUT |
| API | 型契約 | E2Eテスト |

**Phase 4以降で詳細化**: Storybook導入、コンポーネント単位の品質担保など

### 6.3 現状との差分

| 現状 | 移行後 |
|------|--------|
| AGENTS.md + CLAUDE.md | CLAUDE.md のみ |
| app/IMPLEMENTS.md | docs/architecture/frontend.md |
| specs/*.md | E2Eテスト + specs/_archive/ |
| なし | guards/README.md（設計思想） |
| .serena/ | 削除 |

---

## 7. 次のアクション

### ユーザーへの確認事項

1. **この設計方針**（司法がSSOT、docsは人間向け表現）で良いか？
2. **Phase 1のスコープ**は上記で良いか？
3. 修正・追記したい点はあるか？

---

## 変更履歴

| 日付 | 変更内容 |
|-----|---------|
| 2026-01-02 | 初版作成 |
| 2026-01-02 | v2: 「司法がSSOT、docsは人間向け表現」の原則を明確化 |
