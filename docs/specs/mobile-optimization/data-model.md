# Data Model

## TimeTrackerSession
- **Fields**
  - `id: string`
  - `title: string` (必須、非空)
  - `project?: string`
  - `startedAt: number` (epoch millis)
  - `endedAt: number` (epoch millis)
  - `durationSeconds: number`
  - `synced: boolean`
- **Validations**
  - `title` はトリム後 1 文字以上。
  - `endedAt >= startedAt`。
  - `durationSeconds` は `endedAt - startedAt` と一貫。
- **State**
  - 編集モーダルで上書き後は `persistSessions` を通じて保存。

## RunningSessionState
- **Fields**
  - `status: 'idle' | 'running'`
  - `draft: { title?: string; project?: string; startedAt: number }`
  - `elapsedSeconds: number`
- **Validations**
  - `status === 'running'` のとき `draft.startedAt` 必須。
  - UI 側でタイトルが空の場合は開始ボタンを無効化。
- **State Transitions**
  - `idle → running`: `start()` 呼び出し。
  - `running → idle`: `stop()` 後、履歴へセッション追加。

## SyncStatus
- **Fields**
  - `state: 'idle' | 'syncing' | 'error'`
  - `lastSyncedAt?: number`
  - `errorMessage?: string`
- **Usage**
  - バナー表示、設定ダイアログで確認用。

## UIState (新規)
- **HamburgerMenuState**
  - `isMenuOpen: boolean`
  - **Behavior**: 真の場合はオーバーレイ表示と body スクロール抑止。

- **ResponsiveLayoutState**
  - `viewport: 'mobile' | 'desktop'` (メディアクエリ判定結果)
  - **Behavior**: モバイル時のみコンポーネント縦積み・メニュー隠蔽。
