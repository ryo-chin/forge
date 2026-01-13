# エージェント共通指示

**重要**: 作業開始前に必ず `CLAUDE.md` を読んでください。プロジェクトの開発方針・司法（ガードレール）・SSoTが定義されています。

## 言語

- 常に日本語で回答・レビューしてください

## Review guidelines

- `CLAUDE.md` の「司法（ガードレール）がSSOT」に従ってレビューする
- 機能仕様: `app/tests/e2e/` のE2Eテストが通るか確認
- 型安全性: TypeScriptの型エラーがないか確認
- コード品質: `biome.json` のルールに違反していないか確認
- アーキテクチャ境界: `app/.eslintrc.cjs` のルールに違反していないか確認
- ドキュメントより機械的強制を優先する原則に沿っているか確認

## PR要件

PRをマージする前に以下を確認:

1. `pnpm lint` が通ること
2. `pnpm typecheck` が通ること
3. `pnpm test` が通ること
4. E2Eテストが通ること（該当する場合）

## 参照ドキュメント

詳細は以下を参照:

- 開発方針・司法: `CLAUDE.md`
- アーキテクチャ背景: `docs/architecture/`
- 意思決定記録: `docs/adr/`
- 設計思想: `guards/README.md`
