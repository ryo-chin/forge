# コーディングガイドライン

## 基本方針
- **日本語での回答**: ユーザーへの回答は常に日本語で行う
- **AGENTS.md遵守**: リポジトリ内のAGENTS.mdガイドラインに従う
- **プロトタイプルール**: `prototype` ディレクトリ内の実装は他に影響を与えない形で行う

## ディレクトリ構成

### トップレベル構造
```
app/
├── ui/           # UI関連（旧src/ui）
├── features/     # 機能モジュール
├── hooks/        # 共有hooks
├── lib/          # ユーティリティ関数
├── infra/        # インフラ層（storage等）
├── src/          # アプリケーションエントリーポイント
└── tests/        # E2Eテスト等
```

### 機能モジュール構成（features/）
```
features/<feature>/
├── components/   # コンポーネント
│   └── ComponentName/
│       ├── Component.tsx
│       ├── logic.ts      # 純粋関数
│       └── index.ts      # 公開インターフェース
├── pages/        # ページコンポーネント
│   └── PageName/
│       ├── PageName.tsx
│       ├── logic.ts
│       ├── hooks.ts
│       └── index.ts
├── hooks/        # 機能固有hooks
├── domain/       # ドメインロジック・型定義
├── index.ts      # 機能モジュールの公開API
└── index.css     # 機能のスタイル
```

### コンポーネント構成パターン
- **Component.tsx**: UIコンポーネント本体
- **logic.ts**: 純粋関数（副作用なし）
- **hooks.ts**: カスタムhooks（小さな単位で分割）
- **index.ts**: 公開インターフェース（外部はこれ経由でアクセス）

**重要**: 大きな単一用途hooksは避ける。小さな関数・hooksに分割すること。

## コードスタイル

### ESLint設定
- `eslint:recommended`
- `@typescript-eslint/recommended`
- `react-hooks/recommended`
- Prettierと統合
- **import/no-internal-modules**: コンポーネントはindex.ts経由でのみアクセス

### Prettier設定
```json
{
  "singleQuote": true,
  "trailingComma": "all", 
  "tabWidth": 2,
  "semi": true
}
```

### TypeScript
- 厳格な型チェック（`tsc --noEmit`）
- ES2021+ 機能の利用
- モジュール形式（ES modules）
- inline型定義を避け、type定義を上部に配置

## コンポーネント内の構造順序

Composerパターンに従う：
1. 型定義（ファイル上部）
2. 定数
3. コンポーネント関数
   - storage hooks
   - ref
   - state
   - custom hooks
   - memo
   - handlers
   - useEffect（UI副作用のみ）
4. return

## CSS ガイドライン

### スタイル管理
- **機能モジュール単位**: `features/<feature>/index.css`
- **BEM風命名**: `<feature>__element` のように機能名をprefix
- **グローバルスタイル最小限**: `app/src/index.css` はベーススタイルのみ
- **プレーンCSS**: CSS-in-JS/プリプロセッサは当面導入しない

### 共有スタイル
- 複数機能で共有する場合は `app/ui/styles/` に配置
- 追加時はREADMEまたはADRで運用ルール明示

## useEffectの使い方

- **useEffectはUI副作用のみに使用**
- データ永続化などはhandler内で直接実行
- 状態同期が必要な場合のみuseEffectを使用
- 不要なuseEffectは削除し、handlerで直接処理

## バレルファイル運用
- 各機能モジュールは `features/<feature>/index.ts` から公開
- コンポーネントは `components/ComponentName/index.ts` から公開
- 外部公開APIを集約してカプセル化を保つ
- ESLintルールで内部モジュールへの直接アクセスを禁止