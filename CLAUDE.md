# CreVis - CLAUDE.md

## プロジェクト概要
AI分析付き日本語LPギャラリー + CROニュースレターのSaaSプロダクト。
Substack（定期知見配信） × Mobbin（デザインリファレンスDB）のハイブリッドを目指す。

## 技術スタック
- Next.js 14 (App Router) + Tailwind CSS + TypeScript
- Supabase (PostgreSQL + Auth + RLS)
- Cloudflare R2 (画像ストレージ)
- AI: Gemini 2.5 Flash（Phase 1） / Claude Sonnet（Phase 2〜）、切替は `AI_PROVIDER` 環境変数
- メール: Resend
- 決済: Stripe
- デプロイ: Vercel (hnd1 リージョン)

## コード規約
- ES Modules (import/export)、CommonJS 禁止
- 型は `src/types/index.ts` に集約。新しい型はここに追加
- Supabase クライアントは `src/lib/supabase.ts` の `createServiceClient()` を使う
- 管理者認証は `src/lib/auth.ts` の `requireAdminAuth()` を使う
- API Route は Next.js App Router 形式 (`route.ts`)
- UIコンポーネントは `src/components/` 配下。公開側は `public/`、管理側は `admin/`、共通は `ui/`
- Tailwind のカラーはプロジェクト既存の `#111111`, `#1d4ed8`, `#767b74`, `#f7f7f5` 等を踏襲
- 環境変数テンプレートは `.env.local.example` に追加。秘密鍵は `.env.local` のみ

## DB マイグレーション
- `supabase/migrations/` に連番ファイル (例: `002_add_stripe.sql`)
- RLS ポリシーは必ず設定。管理者操作は service_role_key 経由

## テスト・検証
- `npm run build` が通ることを確認してからコミット
- 新しい API Route を追加したら、curl コマンドの使用例をコミットメッセージに含める
- Stripe Webhook は `stripe listen --forward-to localhost:3000/api/stripe/webhook` で検証

## Git
- コミットメッセージは日本語可、prefix: `feat:`, `fix:`, `refactor:`, `chore:`
- 1フェーズ = 1ブランチ → main へ PR マージ
