## Google OAuth認証の設定

このアプリケーションはSupabase経由でGoogle OAuth認証を使用しています。以下の設定が必要ですが、これらはリポジトリには含まれていません:

### 1. Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
2. **APIs & Services** → **Credentials**に移動
3. OAuth 2.0 クライアントIDを作成
4. **承認済みのリダイレクトURI**に以下を追加:
   ```
   # 開発環境
   https://[your-dev-project].supabase.co/auth/v1/callback

   # 本番環境
   https://[your-prod-project].supabase.co/auth/v1/callback
   ```

### 2. Supabaseでの設定

各Supabaseプロジェクト（開発用・本番用）で以下を設定します:

1. **Authentication** → **Providers** → **Google**
    - Google Cloud ConsoleのClient IDとClient Secretを設定
    - 詳細は[Supabaseドキュメント](https://supabase.com/docs/guides/auth/social-login/auth-google)を参照

2. **Authentication** → **URL Configuration**
    - **Site URL**: アプリケーションのURL
        - 開発: `http://localhost:5173`
        - 本番: `https://forge.h031203yama.workers.dev`（実際のデプロイURL）
    - **Redirect URLs**: 認証後のリダイレクト先
        - 開発: `http://localhost:5173/**`
        - 本番: `https://forge.h031203yama.workers.dev/**`
