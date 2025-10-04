# Time Tracker MVP 実装方針

## 実装場所
- **ディレクトリ**: `app-by-claude/` (プロジェクトルート直下)

## 技術スタック
- **フロントエンド**: React/TypeScript
- **状態管理**: Zustand (軽量で即座性重視)
- **UI**: Tailwind CSS + Headless UI
- **データ永続化**: LocalStorage (MVP用)
- **ビルドツール**: Vite

## テスト戦略

### テストフレームワーク
- **単体・コンポーネント**: Vitest + React Testing Library
- **E2E**: Playwright
- **カバレッジ**: c8 (Vite内蔵)

### テスト対象と優先度

#### 高優先度（Phase 1から）
1. **タイマーロジック**: 時間計算、状態管理
2. **セッション管理**: CRUD操作、永続化
3. **基本UI**: 入力→開始→停止フロー

#### 中優先度（Phase 2から）
1. **時刻編集**: 開始時刻修正の正確性
2. **データ整合性**: 編集後のデータ検証
3. **エラーハンドリング**: 異常ケース対応

#### 低優先度（Phase 3で）
1. **パフォーマンス**: レスポンス時間測定
2. **アクセシビリティ**: スクリーンリーダー対応
3. **ブラウザ互換性**: クロスブラウザ動作

### TDD原則
- 新機能は必ずテストファースト
- リファクタリング前に既存テストでカバー
- CI/CDでテスト自動実行

## アーキテクチャ原則

### 1. 即座性最優先
- キーワード入力 → Enter → 即時開始 (1秒以内)
- UI遷移は最小限、オーバーレイベース
- 非同期処理は極力回避

### 2. 段階的情報付与
- **開始時**: タスク名のみ必須
- **実行中**: 任意で詳細編集可能
- **終了後**: まとめて整理可能

### 3. データ設計
```typescript
interface Session {
  id: string
  taskName: string
  startTime: Date
  endTime?: Date
  duration?: number
  tags?: string[]
  project?: string
  skill?: string
  isActive: boolean
}
```

### 4. UI設計原則
- **ホーム**: 入力フィールド1つ + 最小限UI
- **計測中**: 折り畳み式詳細編集
- **履歴**: シンプルなリスト + フィルタ

## 段階的実装戦略

### Phase 1: Core Timer (1-2日)
- 基本タイマー機能
- セッション開始/停止
- LocalStorage永続化

### Phase 2: Edit Features (2-3日)
- 開始時刻修正UI
- セッション中編集
- 履歴表示

### Phase 3: Enhancement (3-4日)
- タグ・プロジェクト機能
- 予測サジェスト
- 基本レポート

## 開発環境セットアップ
1. React + TypeScript + Vite プロジェクト作成
2. 必要依存関係インストール
3. 基本ディレクトリ構造構築
4. 開発サーバー起動確認