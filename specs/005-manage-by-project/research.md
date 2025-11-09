## Research Findings — Manage Sessions by Higher-Level Theme

### 1. Terminology & Naming
- **Decision**: 上位概念は英語名を `Theme`, 日本語 UI 表記を「テーマ」に統一し、既存の `project` は `Project` のまま扱う。ユーザーに表示する際は説明テキストで「細分化されたテーマ内のプロジェクト」として補足する。
- **Rationale**: 「経営者鍛錬」「楽器鍛錬」などを自然な日本語で表現でき、学習領域という文脈にも馴染む。`project` は既存データと UI の整合性が高いため、この段階でのリネームはリスクが大きい。`Theme` と役割が重ならない。
- **Alternatives considered**: `Discipline` は日本語話者に伝わりにくい、`Program` はビジネス文脈が強い、`Category` は既存タグとの混乱が生じる。

### 2. データ構造の拡張方針
- **Decision**: `TimeTrackerSession` と `SessionDraft` に `themeId` と `projectId`（将来は UUID 化）を保持する構造を採用。UI は 2 階層セレクタだが、データ保存時は `classificationPath: string[]` を追加で保持し、さらなる階層が必要になった際の拡張に備える。テーマ/プロジェクトの状態管理は `status ('active'|'archived')` と `updatedAt` で行い、`archivedAt` カラムは導入しない。またテーマ/プロジェクトは `ownerId` を必須フィールドとして所有者単位（現状はサインインユーザー）でスコープする。
- **Rationale**: 既存セッションは `project` を文字列で保持しているため、当面は `project` の文字列を維持しつつ、新しい ID ベースのフィールドを追加して後方互換を確保できる。`classificationPath` の導入により、将来追加の階層を ID 追加するだけで表現可能。
- **Alternatives considered**: ネスト連想オブジェクトはシリアライズ時の整合性が取りにくい。単一文字列に `theme/project` を埋め込む案は将来的な分割が困難。`archivedAt` 単独管理は状態判定ロジックが煩雑になる。

### 3. 永続化・マイグレーション戦略
- **Decision**: LocalStorage はバージョン番号を持たず、旧データは手動マイグレーションスクリプトで変換する。Supabase では新カラム `theme_id uuid` `classification_path text[]` を追加し、既存行はデフォルトテーマ「経営者鍛錬」に紐づける。
- **Rationale**: ユーザーが単独で運用しているため、シンプルな手順書 + スクリプトで十分。Supabase の `uuid` + `text[]` は取扱が簡単で、将来の階層拡張も `classification_path` の配列長を増やすだけで対応できる。
- **Alternatives considered**: LocalStorage にバージョン情報を持たせる案は実装負荷の割に効果が薄い。Supabase の JSONB カラムも候補だったが、既存クエリとの整合を保つには配列の方がシンプル。

### 4. 既存 UI への影響調査
- **Decision**: `Composer` コンポーネントのプロジェクト選択ポップオーバーを 2 段ドロップダウンへ改修。テーマ選択後にプロジェクトリストを絞り込む方式を採用し、キーボード操作トラップは既存実装を再利用。
- **Rationale**: 既存 UI 構造（検索入力 + 候補リスト）と親和性が高く、アクセシビリティ対応（フォーカストラップ）も最小限の修正で済む。
- **Alternatives considered**: 2 カラム表示はモバイルでのスペース不足が懸念。ツリー表示は実装負荷が高い。

### 5. 未確定事項
- **Open Question**: プロジェクトを UUID ベースに再定義するタイミング。現時点では文字列 → 新構造のブリッジのみを実装し、完全移行は別ストーリーで検討する。

### 6. Google スプレッドシート連携
- **Decision**: 既存の `googleSyncTypes` に `theme` プロパティを追加し、エクスポート時は「Theme」列を新設。既存の列順（タイトル、開始/終了時刻、Project 等）は維持し、末尾に追加する。
- **Rationale**: 既存のスプレッドシートテンプレートを大きく変更せずにテーマ情報を共有できる。末尾追加で既存マクロや参照への影響を最小化。
- **Alternatives considered**: Project 列を `Theme / Project` 形式に組み合わせる案は文字列パースが必要になり運用が複雑化。先頭列へ挿入する案は既存参照セルの破壊リスクが高い。
