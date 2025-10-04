# 認証・データ永続化 技術選定 v0.2

最終更新: 2025-09-25 / 作成: 開発チーム

---

## 1. 前提条件
- フロントエンドは Cloudflare Pages or Workers Sites 上でホストし、静的ビルド成果物を配信する。
- 認証は Supabase Auth の Google Provider を利用し、無料枠運用を前提とする。
- データ永続化は Supabase PostgreSQL を採用し、TanStack Query をクライアント状態管理に組み込む。
- 初期構成はフロントエンドから Supabase へ直接アクセスする最小構成とし、Row Level Security (RLS) を必須化する。

## 2. 構成要素と候補

### 2.1 認証/BaaS
| 候補 | 利点 | 懸念 | コスト |
| --- | --- | --- | --- |
| **Supabase Auth（Google Provider）** | Auth + DB が同一プロジェクトで完結。`@supabase/supabase-js` をブラウザから直接利用可能。RLS と組み合わせれば安全に操作できる。 | Google OAuth の審査や同意画面設定に時間が必要な場合がある。 | Free（50k MAU まで） |
| Auth0（Google Social Connection） | OAuth 設定が容易、Rules/Actions で拡張可能。 | Workers でのトークン検証ロジックを別途実装する必要がある。 | Free（7k MAU まで） |

**選定**: Supabase Auth を採用。Auth0 は MAU 制限と構成複雑化のためバックアップ案に留める。

### 2.2 データベース
| 候補 | 利点 | 懸念 | コスト |
| --- | --- | --- | --- |
| **Supabase PostgreSQL** | Auth ユーザーと同じ ID 空間を利用できる。SQL/REST/RPC に対応。 | Edge からのレイテンシが数十 ms 発生する場合がある。 | Free（500MB/8k 月間アクティブ前提） |
| Cloudflare D1 | Workers と同リージョンで低レイテンシ。 | Supabase Auth との ID 連携や RLS 相当の仕組みを自作する必要がある。 | Free（Beta 無料） |

**選定**: Supabase PostgreSQL を採用。D1 は RLS 非対応のため見送り。

### 2.3 フロントエンドフレームワーク
| 候補 | 利点 | 懸念 | コスト |
| --- | --- | --- | --- |
| **Vite + React** | TanStack Query との親和性が高い。Cloudflare Pages でも標準構成。 | ルーティングは React Router 等を別途導入。 | Free |
| Next.js (Static Export) | App Router + Auth.js 等を活用可能。 | Cloudflare 導入時に追加設定が必要。 | Free |

**選定**: Vite + React を採用し、`npm run build` で `dist/` へ静的成果物を出力。

### 2.4 API / アクセス方式
- **初期方針**: フロントエンドから `@supabase/supabase-js` を利用し、Supabase REST/RPC を直接呼び出す。RLS で安全性を担保する。
- **将来検討**: Cloudflare Workers（素の API、itty-router、Hono など）を BFF として導入し、認証トークン検証や外部サービス連携を行う余地を残す。

### 2.5 フロントエンド状態管理
- TanStack Query を中心に、React のローカル state と組み合わせてセッション一覧やユーザープロフィールを管理。
- Supabase Auth の `onAuthStateChange` を監視し、`QueryClient` のキャッシュ無効化/更新に連動させる。

## 3. 環境構築
- `prototype/<branch-name>/` 配下に `package.json` と `wrangler.toml` を配置し、依存関係を閉じる。
- `scripts.build` で `vite build` を呼び出し、Cloudflare Workers の `[assets]` セクションで `dist/` を指す。
- `.env.example` に `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / Google OAuth に必要な環境変数を列挙し、実値は Cloudflare Secrets / GitHub Actions Secrets で管理する。

## 4. 代替案と判断理由
- **Auth0 採用案**: MAU 7k 制限と Cloudflare 連携の追加実装を考慮し、初期段階では見送り。
- **Cloudflare Workers BFF 先行採用案**: 将来的に必要になった時点で導入する。初期はフロント直アクセスで構成を最小化する。
- **Cloudflare D1**: Supabase Auth との統合要件と矛盾するため採用見送り。

## 5. 次のアクション
1. Supabase プロジェクト作成と Google Provider 有効化（同意画面登録含む）。
2. `prototype/<branch-name>/` に Vite + React + Supabase + TanStack Query の最小構成を作成。
3. `sessions` テーブルと RLS ポリシーを定義し、CRUD の PoC を実施。
4. 必要に応じて Cloudflare Workers/BFF の導入要件を整理する。
