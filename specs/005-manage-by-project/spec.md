# Feature Specification: Manage Sessions by Higher-Level Theme

**Feature Branch**: `005-manage-by-project`
**Created**: 2025-11-03
**Status**: ⏸️ FROZEN - アーキテクチャ変更により設計・実装の見直しが必要
**Last Updated**: 2026-01-02
**Input**: User description: "useRunningSessionState の project を上位概念でグルーピングしたい。経営者鍛錬、楽器鍛錬などの大分類を表現し、2階層を基本にしつつ将来拡張余地も残したい。プロジェクトの名称変更（topic/category）も視野に入れる。"

**GitHub Issues**:
- [#20 - [P0] テーマ・プロジェクトの用語・命名規則の決定](https://github.com/ryo-chin/forge/issues/20) - ⚠️ 実装前に必須
- [#21 - [P1] 上位テーマでセッションを整理する（MVP実装）](https://github.com/ryo-chin/forge/issues/21) - #20完了後
- [#22 - [P2] 将来の階層拡張余地を検討する](https://github.com/ryo-chin/forge/issues/22) - #21完了後

**Note**: 他の優先度の高い機能実装のため、このブランチの作業は一時凍結しています。アーキテクチャが変更される可能性があるため、再開時には設計・実装の見直しが必要です。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 上位テーマでセッションを整理する (Priority: P1)

タイムトラッカー利用者として、進行中セッションの「プロジェクト」を複数の大分類（例: 経営者鍛錬 / 楽器鍛錬）に紐づく「テーマ」に整理したい。これにより日々のセッションログを俯瞰して振り返れるようにしたい。

**Why this priority**: 既存の project フィールドだけでは分類が細かくなりすぎ、主要な鍛錬領域ごとの進捗が分かりづらい。分析・レビューに直結する体験価値が高いため P1。

**Independent Test**: 1) 上位テーマを作成 2) 既存/新規 project をテーマに割当 3) セッションを開始・終了すると、履歴がテーマ > project のツリーで確認できる。

**Acceptance Scenarios**:

1. **Given** テーマ「経営者鍛錬」を作成済みでプロジェクト「スプリント計画」が割当済み, **When** セッション開始時にプロジェクト「スプリント計画」を選ぶ, **Then** セッションは「経営者鍛錬 > スプリント計画」に紐づく
2. **Given** テーマに紐づかない既存プロジェクトがある, **When** ユーザーがテーマを未指定のままセッションを開始する, **Then** テーマなしのセッションとして扱われ後から再分類できる

---

### User Story 2 - 将来の階層拡張余地を検討する (Priority: P2)

プロダクトオーナーとして、将来的にテーマ配下へさらに細かい階層（例: サブカテゴリー）を追加できる設計にしたい。現時点では2階層で十分だが、データモデルやAPIで拡張余地を塞がないようにしたい。

**Why this priority**: 直ちに必要ではないが、構造変更が難しくなる前に拡張前提を整理しておくことで将来の開発コストを抑えられる。

**Independent Test**: データモデルの設計資料を確認し、新しい階層を追加した際も破壊的変更を最小化できることをレビューで説明できる。

**Acceptance Scenarios**:

1. **Given** データモデルをレビューする, **When** 新しい階層を追加する場合の手順を追う, **Then** 既存API/ストレージ構造が極力そのまま使える前提が資料化されている

---

### User Story 3 - 用語の整合性を保つ (Priority: P3)

チームメンバーとして、UIやコード内の命名を変更した場合（例: project → topic）に整合性のあるガイドラインを参照したい。

**Why this priority**: 命名の変更は影響範囲が広いため、ドキュメントの不足が混乱を招く。

**Independent Test**: 命名変更の有無に応じたガイドラインが `docs` / `app/IMPLEMENTS.md` に追記され、レビューで参照できる。

**Acceptance Scenarios**:

1. **Given** 命名変更を決定した, **When** ガイドラインを参照する, **Then** UI/コード/ドキュメントで使う語彙が明示されている

### Edge Cases

- 既存セッションが上位テーマ未設定のまま残っている場合の扱いはどうするか？
- テーマを削除した場合に紐づく project / セッションはどう移行するか？
- データ永続化先が LocalStorage / Supabase いずれの場合でもテーマ情報を安全にマイグレーションできるか？

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: ユーザーは上位テーマを作成・編集・削除できる。
- **FR-002**: プロジェクト（現行 project フィールド相当）はテーマに割り当てられる。テーマ未設定も許容する。
- **FR-003**: セッション開始時、ユーザーはテーマ > プロジェクトの構造から分類を選択できる。
- **FR-004**: 既存セッションはテーマ未設定として扱われ、後から再分類できる UI / API が用意される。
- **FR-005**: テーマ情報は永続化され、LocalStorage / Supabase 双方で読み書きできる。
- **FR-006**: 将来追加の階層（サブカテゴリー等）を導入する場合に破壊的変更を最小化できるよう、データモデル/API設計に拡張余地を残す。
- **FR-007**: (NEEDS CLARIFICATION) project フィールドの命名変更（topic/category 等）を行うかどうか、および UI 表示方針を決定する。
- **FR-008**: Google スプレッドシート連携時にテーマ情報を新しいカラムとして同期し、既存カラムとの互換性を維持する。
- **FR-009**: 既存セッションはマイグレーション時にデフォルトテーマ「経営者鍛錬」に自動で紐づけられる。
- **FR-010**: テーマおよびプロジェクトは所有者単位（現状はサインインユーザー）で管理され、同一所有者内でのみ表示・編集できる（Supabase では `owner_id` カラムで関連付ける）。

### Key Entities *(include if feature involves data)*

- **Theme**: 所有者（現時点ではユーザー）が定義する上位カテゴリ。属性: `id`, `ownerId`, `name`, `createdAt`, `updatedAt`, `status`, `color?`, `description?`.
- **Project / Topic**: 現行の project 概念。テーマへの外部キーを保持。属性: `id`, `ownerId`, `themeId?`, `name`, `createdAt`, `updatedAt`, `status`.
- **TimeTrackerSession**: 既存セッション。拡張として `themeId` / `projectId` を持つ。プロジェクト未設定の場合はいずれも `null`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 80%以上の新規セッションがテーマを持つようになり、ユーザーがテーマ分類を利用していることを指標として確認できる。
- **SC-002**: マイグレーション後も既存セッションの表示に失敗しない（0% の読み込みエラー・欠損）。
- **SC-003**: テーマの追加/削除操作は 200ms 未満で完了し、UX に支障がない。
- **SC-004**: 命名変更を行う場合、該当ドキュメントがリリース時点で更新完了している（レビューで確認）。
- **SC-005**: Google スプレッドシート連携でエクスポートされた新しいテーマ列が既存テンプレートで正しく表示される（同期シートで欠落セル 0 件）。
- **SC-006**: マイグレーション後、既存セッションの `themeId` がすべてデフォルトテーマ「経営者鍛錬」を指している。
