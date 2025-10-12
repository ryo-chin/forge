# Google Sheets API v4統合調査レポート

**調査日**: 2025-10-12
**対象**: TypeScript/React Webアプリケーション（Cloudflare Workers/Pages環境）

---

## Decision（決定事項）

**REST API + Fetch による直接実装を採用**

Google Sheets APIとの統合には、Node.js専用ライブラリではなく、REST APIエンドポイントに直接アクセスする実装方式を推奨します。

### 具体的な実装方針

1. **API通信レイヤー**: Fetch API + Bearer Token認証
2. **認証フロー**: OAuth 2.0 Authorization Code Flow with PKCE
3. **トークン管理**: Supabaseにprovider_tokenとrefresh_tokenを暗号化保存
4. **スコープ**: `https://www.googleapis.com/auth/spreadsheets`（読み書き）

---

## Rationale（選択理由）

### 1. Cloudflare Workers環境との互換性

**課題**:
- `googleapis`パッケージはNode.js固有のAPIに依存しており、Cloudflare WorkersのV8 Isolate環境では直接動作しない
- `google-spreadsheet`も同様にNode.js環境を前提としている

**解決策**:
- Google Sheets API v4はRESTful APIとして提供されており、標準のFetch APIで直接アクセス可能
- Cloudflare Workersは標準Web APIをサポートしているため、互換性の問題が発生しない

### 2. 軽量性とパフォーマンス

- `googleapis`パッケージは全てのGoogle APIをサポートする大規模なメタツールであり、バンドルサイズが大きい
- REST API直接実装は必要な機能のみを実装でき、エッジ環境でのコールドスタート時間を最小化できる

### 3. 制御性と透明性

- API呼び出しのロジックが明示的になり、デバッグやカスタマイズが容易
- レート制限、エラーハンドリング、リトライロジックを細かく制御可能

### 4. OAuth 2.0フローの柔軟性

- Supabase Authとの統合が明確に設計可能
- PKCE対応のセキュアな認証フローを実装できる

---

## Alternatives Considered（検討した代替案）

### Alternative 1: `googleapis` npm package

**概要**:
- Googleの公式Node.js/TypeScriptクライアントライブラリ
- 全てのGoogle APIをサポートする包括的なツール

**メリット**:
- 公式サポートがあり、型定義が充実
- 複数のGoogle APIを使う場合に統一されたインターフェース

**デメリット**:
- Cloudflare Workersで動作させるには`nodejs_compat`フラグと`gtoken`のカスタムオーバーライドが必要
- バンドルサイズが非常に大きい（数MB）
- エッジ環境での動作保証がない

**評価**: ❌ 不採用
- Node.js依存が強く、Cloudflare Workers環境での動作が不安定
- バンドルサイズの増加がエッジ環境のパフォーマンスに悪影響

### Alternative 2: `google-spreadsheet` npm package

**概要**:
- コミュニティ製のGoogle Sheets専用ラッパーライブラリ
- v5.0.2が最新（2025年8月リリース）

**メリット**:
- Sheets APIに特化しており、`googleapis`より軽量
- より直感的なAPIインターフェース
- TypeScriptサポートあり

**デメリット**:
- Node.js環境を前提とした設計
- Cloudflare Workers互換性に関する公式情報なし
- 内部的に`googleapis`に依存している可能性

**評価**: ❌ 不採用
- エッジ環境での動作が保証されない
- REST API直接実装と比較してメリットが小さい

### Alternative 3: Service Account + JWT認証

**概要**:
- サービスアカウントを使用し、JWTトークンで認証
- OAuth 2.0フローなしでAPI呼び出しが可能

**メリット**:
- ユーザー認証フローが不要
- サーバー間通信に適している

**デメリット**:
- **ユーザーのスプレッドシートにアクセスできない**
- サービスアカウント専用のスプレッドシートのみアクセス可能
- 本プロジェクトの要件（ユーザーのスプレッドシート読み書き）に不適合

**評価**: ❌ 不採用
- 要件を満たさない（ユーザーのスプレッドシートへのアクセスが不可）

---

## Integration Notes（実装の重要ポイント）

### 1. Google Sheets API認証フロー

#### OAuth 2.0 Authorization Code Flow with PKCE

**フロー概要**:
```
1. アプリケーション: PKCE code_verifierとcode_challengeを生成
2. ユーザー: Google認証画面へリダイレクト
3. Google: 認証後、callbackエンドポイントへauthorization codeを返す
4. アプリケーション: authorization codeとcode_verifierを使ってaccess tokenを取得
5. アプリケーション: provider_tokenとrefresh_tokenをSupabaseに保存
```

**実装例（Supabase統合）**:
```typescript
// 1. OAuth開始
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    scopes: 'https://www.googleapis.com/auth/spreadsheets',
    redirectTo: `${window.location.origin}/auth/callback`,
    queryParams: {
      access_type: 'offline', // refresh_tokenを取得するために必須
      prompt: 'consent',      // refresh_tokenを確実に取得
    },
  },
})

// 2. Callbackでprovider_tokenを取得
const session = await supabase.auth.getSession()
const providerToken = session.data.session?.provider_token
const providerRefreshToken = session.data.session?.provider_refresh_token

// 3. トークンをSupabaseに保存（暗号化推奨）
await supabase
  .from('google_tokens')
  .upsert({
    user_id: session.data.session?.user.id,
    access_token: providerToken,
    refresh_token: providerRefreshToken,
    expires_at: new Date(Date.now() + 3600 * 1000), // 1時間後
  })
```

**重要事項**:
- Supabaseは**provider_tokenを保存しない**ため、アプリケーション側で管理が必要
- `access_type: 'offline'`と`prompt: 'consent'`を指定しないとrefresh_tokenが取得できない
- Google Cloudコンソールで認可済みリダイレクトURIを設定する必要がある

### 2. Google Sheets API呼び出し

#### REST APIエンドポイント

**基本形式**:
```
https://sheets.googleapis.com/v4/spreadsheets/{spreadsheetId}/{endpoint}
```

**実装例**:
```typescript
// データ取得
async function getSheetData(
  spreadsheetId: string,
  range: string,
  accessToken: string
) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Sheets API error: ${response.status}`)
  }

  return response.json()
}

// データ書き込み
async function updateSheetData(
  spreadsheetId: string,
  range: string,
  values: any[][],
  accessToken: string
) {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values }),
    }
  )

  if (!response.ok) {
    throw new Error(`Sheets API error: ${response.status}`)
  }

  return response.json()
}
```

### 3. トークンリフレッシュ処理

**access_tokenの有効期限**: 1時間

**リフレッシュフロー**:
```typescript
async function refreshGoogleToken(refreshToken: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const data = await response.json()
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in, // 秒単位
  }
}

// 自動リフレッシュラッパー
async function withTokenRefresh<T>(
  fn: (token: string) => Promise<T>,
  userId: string
): Promise<T> {
  const tokens = await getStoredTokens(userId)

  // トークンの有効期限チェック
  if (new Date() >= tokens.expires_at) {
    const { accessToken, expiresIn } = await refreshGoogleToken(tokens.refresh_token)

    // 新しいトークンを保存
    await updateStoredTokens(userId, {
      access_token: accessToken,
      expires_at: new Date(Date.now() + expiresIn * 1000),
    })

    return fn(accessToken)
  }

  return fn(tokens.access_token)
}
```

**重要事項**:
- refresh_tokenは**100回のリフレッシュで無効化**される（Googleの制限）
- 分散システムでは共有キャッシュにrefresh_tokenを保存して競合を防ぐ
- トークンの有効期限切れを検知し、自動的にリフレッシュする仕組みが必須

### 4. レート制限とエラーハンドリング

#### APIクォータ

| 種別 | 制限 |
|------|------|
| Per Project | 500 requests / 100秒 |
| Per User | 100 requests / 100秒 |
| Read requests | 300 requests / 分 |

#### 429エラーハンドリング

```typescript
async function apiCallWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error: any) {
      if (error.status === 429) {
        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, i), 60000) // 最大60秒
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}
```

**推奨事項**:
- レート制限超過時は指数バックオフアルゴリズムを使用
- 1分後にリクエストが再実行可能になる
- プロジェクトベースのクォータは申請により拡張可能（最大2500/アカウント）

### 5. OAuth スコープ

#### 推奨スコープ

```
https://www.googleapis.com/auth/spreadsheets
```

- ユーザーのスプレッドシートに対する読み書き権限
- プロパティの変更も可能

#### 読み取り専用が必要な場合

```
https://www.googleapis.com/auth/spreadsheets.readonly
```

#### スコープの制限事項

- **スコープはAPI全体に適用され、特定のファイルIDに限定できない**
- ユーザーが所有する全てのスプレッドシートへのアクセス権限が付与される
- 最小権限の原則に従い、必要最小限のスコープを要求すること

### 6. セキュリティ対策

#### トークン保存

```typescript
// Supabaseテーブル設計例
create table google_tokens (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  access_token text not null,      -- 暗号化推奨
  refresh_token text not null,     -- 暗号化推奨
  expires_at timestamptz not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id)
);

-- Row Level Security (RLS)
alter table google_tokens enable row level security;

create policy "Users can only access own tokens"
  on google_tokens for all
  using (auth.uid() = user_id);
```

**重要事項**:
- トークンは必ず暗号化して保存（Google Cloud Secret Managerなどを推奨）
- RLS（Row Level Security）でユーザー自身のトークンのみアクセス可能に制限
- ブラウザのLocalStorageへの保存は避ける（XSS攻撃のリスク）
- トークンをコードリポジトリにコミットしない

#### CSRF対策

```typescript
// OAuth開始時
const state = crypto.randomUUID()
sessionStorage.setItem('oauth_state', state)

await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    // ...
    queryParams: {
      state,
    },
  },
})

// Callback時
const urlParams = new URLSearchParams(window.location.search)
const returnedState = urlParams.get('state')
const storedState = sessionStorage.getItem('oauth_state')

if (returnedState !== storedState) {
  throw new Error('CSRF validation failed')
}
```

### 7. アーキテクチャ統合（本プロジェクト）

#### ディレクトリ構成

```
app/
├── infra/
│   └── google-sheets/
│       ├── sheetsApi.ts          # REST API呼び出しロジック
│       └── tokenManager.ts       # トークン管理
├── hooks/
│   └── data/
│       ├── useGoogleAuth.ts      # OAuth認証フック
│       └── useGoogleSheets.ts    # Sheets操作フック
└── features/
    └── spreadsheet-sync/
        ├── components/
        ├── hooks/
        │   └── data/
        │       └── useSheetSync.ts
        └── pages/
```

#### 実装例

```typescript
// infra/google-sheets/sheetsApi.ts
export class GoogleSheetsApiClient {
  constructor(private accessToken: string) {}

  async getValues(spreadsheetId: string, range: string) {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      throw new Error(`Sheets API error: ${response.status}`)
    }

    return response.json()
  }

  // ... その他のメソッド
}

// hooks/data/useGoogleSheets.ts
export function useGoogleSheets() {
  const { data: tokens } = useGoogleTokens()

  const getSheetData = useCallback(
    async (spreadsheetId: string, range: string) => {
      if (!tokens?.access_token) {
        throw new Error('Not authenticated')
      }

      const client = new GoogleSheetsApiClient(tokens.access_token)
      return client.getValues(spreadsheetId, range)
    },
    [tokens]
  )

  return { getSheetData }
}
```

---

## Performance Considerations（パフォーマンス考慮事項）

### 1. エッジキャッシング

- Cloudflare Workers KVを使用してAPI応答をキャッシュ
- キャッシュヒット時: 約30ms
- キャッシュミス時: 約500-1000ms

### 2. バッチ処理

- 複数のセル範囲を取得する場合は`batchGet`エンドポイントを使用
- レート制限の消費を抑えられる

```typescript
async function batchGetValues(
  spreadsheetId: string,
  ranges: string[],
  accessToken: string
) {
  const rangeParams = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')

  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${rangeParams}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )

  return response.json()
}
```

### 3. 同期戦略

- **polling**: 定期的にAPI呼び出し（レート制限に注意）
- **webhook**: Google Apps Scriptでトリガーを設定し、変更時に通知
- **manual sync**: ユーザーが明示的に同期ボタンをクリック

---

## References（参考資料）

### 公式ドキュメント
- [Google Sheets API v4 Reference](https://developers.google.com/workspace/sheets/api/reference/rest)
- [Google OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Supabase PKCE Flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Cloudflare Workers Node.js Compatibility](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)

### 関連記事
- [Using googleapis with Cloudflare Workers](https://medium.com/@bjornbeishline/using-googleapis-with-cloudflare-workers-33b9b6de26c4)
- [Google Sheets API Usage Limits](https://developers.google.com/workspace/sheets/api/limits)
- [OAuth 2.0 Best Practices (2025)](https://developers.google.com/identity/protocols/oauth2/resources/best-practices)

---

## Next Steps（次のステップ）

1. **Google Cloud Consoleでプロジェクトとクレデンシャルを作成**
   - OAuth 2.0クライアントIDの発行
   - 認可済みリダイレクトURIの設定
   - Sheets API v4の有効化

2. **Supabaseテーブル設計**
   - `google_tokens`テーブルの作成
   - RLSポリシーの設定

3. **認証フローの実装**
   - `useGoogleAuth`フックの実装
   - Callbackエンドポイントの作成
   - トークンリフレッシュロジックの実装

4. **Sheets API統合**
   - `GoogleSheetsApiClient`の実装
   - `useGoogleSheets`フックの実装
   - エラーハンドリングとリトライロジック

5. **テスト**
   - OAuth認証フローのテスト
   - API呼び出しのユニットテスト
   - レート制限ハンドリングのテスト

---

## Conclusion（まとめ）

Cloudflare Workers/Pages環境でのGoogle Sheets API v4統合には、**REST API + Fetch API**による直接実装が最適です。

この方式により：
- ✅ エッジ環境との完全な互換性
- ✅ 軽量なバンドルサイズ
- ✅ 柔軟なエラーハンドリングとリトライロジック
- ✅ Supabase Authとのシームレスな統合

を実現できます。

OAuth 2.0 PKCE フローとSupabaseによるトークン管理を組み合わせることで、セキュアかつスケーラブルなスプレッドシート連携機能を構築可能です。
