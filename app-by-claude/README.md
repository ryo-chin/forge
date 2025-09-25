# Time Tracker MVP

技術・楽器などの鍛錬時間を計測する個人向けタイムトラッカーアプリ

## 技術構成

- **フロントエンド**: React + TypeScript
- **ビルドツール**: Vite
- **状態管理**: Zustand
- **UI**: Tailwind CSS + Headless UI
- **テスト**: Vitest + React Testing Library + Playwright

## セットアップ

依存関係をインストール:
```bash
npm install
```

## 実行方法

### 開発サーバー起動
```bash
npm run dev
```
→ http://localhost:5173 でアクセス

### テスト実行
```bash
npm run test        # ウォッチモード
npm run test:run    # 一回実行
npm run test:coverage # カバレッジ付き
npm run test:e2e    # E2Eテスト（Playwright）
```

### ビルド・その他
```bash
npm run build      # 本番ビルド
npm run preview    # ビルド結果プレビュー
npm run lint       # ESLint実行
```

## 開発方針

### UX設計
- **即座性重視**: キーワード入力 → Enter → 即時開始 (1秒以内)
- **段階的情報付与**: 開始時最小限 → 実行中・終了後に詳細編集可能
- **Google検索風UI**: 入力フィールド1つのシンプルな開始画面

### 開発手法
- **TDD**: テストファースト開発
- **段階的実装**: Phase 1 → 2 → 3 で機能を段階的に構築
- **リファクタリング安全性**: 自動テストによる品質保証

### アーキテクチャ原則
- **即座性最優先**: UI遷移最小限、非同期処理回避、1秒以内レスポンス
- **段階的情報付与**: 開始時必須項目最小→実行中任意編集→終了後整理
- **データ層分離**: 型定義、ビジネスロジック、状態管理、永続化の明確な分離
- **テスト**: 単体・統合・E2E

### UI設計原則
- **ホーム画面**: 入力フィールド1つのシンプル設計（Google検索風）
- **計測中画面**: 折り畳み式詳細編集でシンプルさ維持
- **履歴画面**: リスト + フィルタのクリーンな構成

## ディレクトリ構造

```
src/
├── components/     # Reactコンポーネント
├── hooks/          # カスタムフック
├── stores/         # Zustand状態管理
├── utils/          # ユーティリティ関数
└── test/           # テストセットアップ
tests/              # 統合テスト
e2e/                # E2Eテスト
```
