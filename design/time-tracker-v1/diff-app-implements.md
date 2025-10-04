# `app/IMPLEMENTS.md` 差分レポート

## 1. ルートディレクトリ構成
- **ガイドライン**: `app/infra/`, `app/hooks/`, `app/hooks/data/`, `app/lib/`, `app/ui/`, `app/features/...` を並列に配置する。
- **現状**: `app/` 直下には `features/`, `src/`, `tests/` などが存在し、`infra`, `hooks`, `lib`, `ui` は未作成。
- **ギャップ**: 共有ディレクトリ群が欠如しており、ビルド設定も旧構成のまま。

## 2. shared hooks / data hooks
- **ガイドライン**: フレームワーク非依存な共通カスタムフックは `app/hooks/`、アプリ全体で共有するデータ取得は `app/hooks/data/` に配置する。
- **現状**: 共通フック用のディレクトリが存在せず、`useRunningSession` のみが `app/features/time-tracker/src/hooks` に置かれている。
- **ギャップ**: グローバルデータフックの足場がなく、機能内フックも再配置が必要。

## 3. infra 層
- **ガイドライン**: API クライアントや LocalStorage アクセスなどは `app/infra/<subsystem>/` に集約して `hooks/data` 経由で利用する。
- **現状**: LocalStorage とのやり取り (`loadStoredSessions`, `loadStoredRunningState`) が `TimeTrackerRoot.tsx` 内に存在。
- **ギャップ**: プラットフォーム依存コードが UI コンポーネント内に混在。

## 4. lib 層
- **ガイドライン**: 純粋関数やフォーマッタは `app/lib/` に配置し、副作用を持たせない。
- **現状**: セッションパーサー、日付/タイマーのフォーマッタなどが `TimeTrackerRoot.tsx` に内包されている。
- **ギャップ**: ドメイン/ユーティリティ関数の切り出し未実施。

## 5. UI コンポーネント
- **ガイドライン**: 共有 UI は `app/ui/`、機能固有 UI は `app/features/<feature>/components/<Component>/` と `*.hooks.ts` で構成。
- **現状**: `TimeTrackerRoot.tsx` が画面全体を担い、コンポーネント分割は未実施。共有 UI も存在しない。
- **ギャップ**: `Composer`, `HistoryList`, `EditorModal` などの切り出し、`*.hooks.ts` 化が必要。

## 6. ドメイン層
- **ガイドライン**: `app/features/<feature>/domain/` に副作用のないロジックを集約。
- **現状**: `domain/runningSession.ts` は存在するが、セッションパースやフォーマッタ等が UI コンポーネント内に残存。
- **ギャップ**: ドメイン関数の網羅的な整理とテストの配置が未完。

## 7. ルーティング / ページ層
- **ガイドライン**: ルートエントリは `app/features/<feature>/pages/` に配置し、子コンポーネントへ props を橋渡しする。
- **現状**: `TimeTrackerRoot.tsx` が `src/` 直下に存在し、`pages/` ディレクトリは未作成。
- **ギャップ**: ページ層の導入と props 伝播設計の見直しが必要。

## 8. 依存関係の明確化
- **ガイドライン**: `infra -> hooks/data -> features` の流れを守り、循環や暗黙依存を排除。
- **現状**: LocalStorage や純粋関数が直接 UI から参照され、層境界があいまい。
- **ギャップ**: 依存方向を再構築し、CI (lint/tsc) で検証できる状態を整備する必要がある。

## 9. ドキュメント整備
- **ガイドライン**: リファクタ後に README やガイドラインを更新する。
- **現状**: 差分レポートがなく、移行順序も未整理。
- **ギャップ**: 本レポートを出発点に、フェーズ8タスクへ優先度を付与する必要がある。
