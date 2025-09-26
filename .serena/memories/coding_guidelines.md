# コーディングガイドライン

## 基本方針
- **日本語での回答**: ユーザーへの回答は常に日本語で行う
- **AGENTS.md遵守**: リポジトリ内のAGENTS.mdガイドラインに従う
- **プロトタイプルール**: `prototype` ディレクトリ内の実装は他に影響を与えない形で行う

## コードスタイル

### ESLint設定
- `eslint:recommended`
- `@typescript-eslint/recommended`
- `react-hooks/recommended`
- Prettierと統合

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

## CSS ガイドライン（ADR 2025-09-25）

### スタイル管理
- **機能モジュール単位**: `features/<feature>/src/index.css`
- **BEM風命名**: `time-tracker__panel` のように機能名をprefix
- **グローバルスタイル最小限**: `app/src/index.css` はベーススタイルのみ
- **プレーンCSS**: CSS-in-JS/プリプロセッサは当面導入しない

### 共有スタイル
- 複数機能で共有する場合は `app/shared/styles/` に配置
- 追加時はREADMEまたはADRで運用ルール明示

## バレルファイル運用
- 各機能モジュールは `features/<feature>/src/index.ts` から公開
- 外部公開APIを集約してカプセル化を保つ