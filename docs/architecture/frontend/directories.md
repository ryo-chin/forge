# ディレクトリ構成ガイド

> このドキュメントは `app/.eslintrc.cjs` 等の司法（ガードレール）の「人間向け表現」です。
> SSoTは各設定ファイルです。

## app/src/ ディレクトリ構成

```
app/src/
├── features/           # 機能モジュール（最大の単位）
│   └── <feature>/
│       ├── components/ # UIコンポーネント
│       ├── domain/     # 純粋ロジック
│       ├── hooks/
│       │   └── data/   # データ取得・更新フック
│       ├── pages/      # ページ/ルートコンポーネント
│       └── index.ts    # 公開API
│
├── hooks/              # 共有フック
│   └── data/           # グローバルデータ取得フック
│
├── infra/              # インフラストラクチャ層
│   ├── api/            # APIクライアント
│   ├── auth/           # 認証関連
│   ├── config/         # 設定
│   ├── google/         # Google API連携
│   ├── localstorage/   # LocalStorage実装
│   ├── repository/     # リポジトリ（データソース抽象化）
│   └── supabase/       # Supabase連携
│
├── lib/                # 純粋ユーティリティ
│   ├── accessibility/  # アクセシビリティ関連
│   ├── date.ts         # 日付操作
│   └── time.ts         # 時間操作
│
├── router/             # ルーティング定義
│
├── ui/                 # デザインシステム・共有UI
│   ├── components/     # 共有コンポーネント
│   ├── hooks/          # UI専用フック
│   ├── layouts/        # レイアウトコンポーネント
│   └── tokens/         # デザイントークン
│
├── index.css           # グローバルスタイル
└── main.tsx            # エントリーポイント
```

## 各ディレクトリの役割

### features/\<feature\>/

機能単位でコードをグループ化する最大の単位。

| サブディレクトリ | 役割 |
|----------------|------|
| `components/` | UIコンポーネント（表示、イベント処理） |
| `domain/` | 純粋ロジック（計算、バリデーション、型定義） |
| `hooks/data/` | データ取得・更新フック（infra層への窓口） |
| `pages/` | ページ/ルートコンポーネント |

**コンポーネント構成例**:
```
components/
└── Composer/
    ├── Composer.tsx      # メインコンポーネント
    ├── logic.ts          # サイドカーファイル（再利用処理）
    ├── Composer.css      # スタイル
    ├── __tests__/        # テスト
    │   └── Composer.test.tsx
    └── index.ts          # バレル
```

### infra/

外部システムとの接点を担う。

| サブディレクトリ | 役割 |
|----------------|------|
| `api/` | HTTPクライアント、RESTful API呼び出し |
| `auth/` | 認証プロバイダー、トークン管理 |
| `config/` | 環境設定、フィーチャーフラグ |
| `google/` | Google API（Sheets等）クライアント |
| `localstorage/` | ブラウザLocalStorage操作 |
| `repository/` | データソース抽象化（Repository Pattern） |
| `supabase/` | Supabaseクライアント、リアルタイム同期 |

### hooks/

機能横断で共有するフック。

| サブディレクトリ | 役割 |
|----------------|------|
| `data/` | アプリ全体で共有するデータ取得フック |
| (直下) | UI再利用フック（useIntersectionObserver等） |

### lib/

副作用を持たない純粋ユーティリティ。

**原則**:
- 純粋関数のみ
- テスト併設
- どのレイヤーからも参照可能

### ui/

デザインシステムと共有UIコンポーネント。

| サブディレクトリ | 役割 |
|----------------|------|
| `components/` | Button, Modal等の共有コンポーネント |
| `hooks/` | UI専用フック（useResponsiveLayout等） |
| `layouts/` | AppLayout, AppNav等のレイアウト |
| `tokens/` | 色、スペーシング等のデザイントークン |

**制約**:
- 機能固有の状態を持ち込まない
- プレゼンテーション目的でのみ参照

## ファイル命名規則

| 種類 | 規則 | 例 |
|-----|------|-----|
| コンポーネント | PascalCase | `Composer.tsx` |
| フック | camelCase + use接頭辞 | `useRunningSession.ts` |
| ユーティリティ | camelCase | `formatDuration.ts` |
| 型定義 | camelCase + types | `types.ts`, `googleSyncTypes.ts` |
| テスト | 対象ファイル + .test | `Composer.test.tsx` |
| サイドカー | logic.ts, *.hooks.ts | `logic.ts`, `Composer.hooks.ts` |

## 機能間の依存

機能間の依存は最小限に留める。

**許可されるパターン**:
```typescript
// features/settings/ から features/time-tracker/ を参照
import { TimeTrackerExports } from '@/features/time-tracker';
```

**禁止されるパターン**:
```typescript
// 内部モジュールへの直接アクセス
import { Composer } from '@/features/time-tracker/components/Composer';
```

公開APIは `features/<feature>/index.ts` で明示的にエクスポートする。
