# ADR 2025-12-01 — タイムトラッカーのレイヤリング戦略

## 背景
- `TimeTrackerRoot.tsx` が UI 表示・状態遷移・永続化・アクセシビリティ対応を一括で担い、1,000 行規模の巨大コンポーネントになっている。
- 現状は `localStorage` を直接参照しているが、将来的にバックエンド API や React Query などのデータ取得ライブラリを導入する計画がある。
- UI を拡張しつつ変更耐性を高めるため、責務分割と依存方向を明文化しておきたい。

## 決定
1. **レイヤー構成を Domain / Service / Presenter / UI に分離する**
   - Domain: 計算・バリデーションなど純粋ロジックを `domain/` 配下に保持し、副作用を持たない。
   - Service: 外界との接合点を担い、`SessionRepository` などのインターフェイスを定義。現行は `LocalSessionRepository` を実装し、将来は `RemoteSessionRepository` を差し替え可能にする。
   - Presenter: `presenters/` 配下のカスタムフックで Service を注入し、状態遷移とアクションを集約する。名称は `useTimeTracker` のように役割を表すものとし、`Presenter` サフィックスは付けない。UI はこの層の公開 API のみを利用する。
   - UI: `components/` 配下で `Composer`, `RunningStatus`, `NudgeControls`, `HistoryList`, `SessionModal` などのプレゼンテーションコンポーネントに分割する。
2. **Service 層で将来のデータ取得ライブラリをラップする**
   - React Query / SWR 等を導入する場合も Repository 実装内部で利用し、Presenter や UI へは抽象化されたメソッドのみを公開する。
   - API 呼び出し・キャッシュ制御・エラーハンドリングは Service 層に閉じ込め、UI は非同期制御を意識しない。
3. **依存方向のルールを固定する**
   - UI → Presenter → Service → Domain の一方向依存とし、Domain は他レイヤーへ依存しない。
   - テストでは Domain を最優先でカバーし、Service 層はモック可能なインターフェイス経由で検証する。

## 影響
- 既存の `TimeTrackerRoot.tsx` は段階的に責務を移譲し、小さなコンポーネントとフックに分解する必要がある。
- ローカルストレージ操作コードは Service 層に切り出されるため、テストはインターフェイスをモックして通す方針に改める。
- 将来バックエンドを導入する際は Repository 実装を差し替えるだけで UI/Domain を再利用できる。

## メモ
- 抽出作業は「ストレージ責務→UIブロック→モーダル/ポップオーバー→Presenter 集約」の順に行い、フェーズごとにテストを緑に戻す。
- Service 層の命名は手段ではなく役割を表す（例: `SessionRepository`）ことを徹底し、具象クラスで実装詳細を表現する。
- React Query 等を採用する場合は Repository 実装内で `queryClient` を利用し、UI へ露出させない。
