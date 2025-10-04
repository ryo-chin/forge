# プロジェクト概要

## プロジェクトの目的
- タイムトラッカーMVPの開発を主軸とした、段階的にアプリケーション機能を拡張していくプロジェクト
- `app/` がアプリケーション全体のルートで、Cloudflareでのプロトタイプ展開も含む

## 技術スタック
- **フロントエンド**: React 18 + TypeScript 5.4+
- **ビルドツール**: Vite 5.2
- **テスティング**: Vitest（ユニットテスト）+ Playwright（E2Eテスト）+ Testing Library
- **リンティング**: ESLint 8.57 + TypeScript ESLint
- **フォーマット**: Prettier
- **開発環境**: Node.js（ES modules）

## アーキテクチャ原則
- **即時スタート体験を維持**: ユーザーがすぐに作業を開始できるUI設計
- **情報は段階的に開示**: 必要に応じて詳細情報を表示
- **共通スキーマ**: `Session { id, title, startedAt, endedAt, durationSeconds, ... }` を統一データ構造として使用

## プロジェクト構造
```
forge/
├── app/                  # メインアプリケーション
│   ├── features/         # 機能モジュール
│   │   └── time-tracker/ # タイムトラッカー機能
│   └── src/              # アプリケーションコア
├── design/               # デザイン仕様・検討資料
├── docs/                 # ドキュメント・ADR
└── prototype/            # プロトタイプ（Cloudflare展開用）
```

## 開発フロー
- TDD（テスト駆動開発）を基本とする
- バレルファイル運用（features/<feature>/src/index.ts から公開API集約）
- プロトタイプは `prototype/<branch-name>/` に配置してCloudflare Workers で展開
