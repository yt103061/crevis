# CreVis — AIネイティブ LP ギャラリー＋ニュースレター

日本のデザイナー・Webマーケターが「成果の出るLP」を素早く発見・参照できるプラットフォーム。
AIによる構造分析・コピー評価・稼働期間推定で成果推定スコアを算出し、デザイン判断の根拠を提供します。

> 詳細な要件定義書は [docs/PRD.md](./docs/PRD.md) を参照してください。

## 技術スタック

- **Frontend/Backend:** Next.js 14 + Tailwind CSS
- **DB + Auth:** Supabase (PostgreSQL + Auth)
- **画像ストレージ:** Cloudflare R2
- **AI分析:** Gemini 2.5 Flash（Phase 1）→ Claude claude-sonnet-4-20250514（Phase 2）
- **メール配信:** Resend
- **決済:** Stripe（Phase 2〜）
- **デプロイ:** Vercel

## セットアップ

```bash
npm install
cp .env.local.example .env.local
# .env.local に必要な環境変数を設定
npm run dev
```

[http://localhost:3000](http://localhost:3000) でアプリが起動します。

## ディレクトリ構成

```
src/
├── app/                    # Next.js App Router
│   ├── admin/              # 管理画面
│   ├── api/                # APIルート
│   ├── lp/[id]/            # LP詳細ページ
│   ├── newsletter/         # ニュースレターページ
│   ├── search/             # 検索ページ
│   └── page.tsx            # トップ（ギャラリー）
├── components/             # UIコンポーネント
├── lib/                    # ユーティリティ・クライアント
│   ├── ai-client.ts        # AI API切替ラッパー
│   ├── auth.ts             # 認証ヘルパー
│   ├── r2.ts               # Cloudflare R2クライアント
│   └── supabase.ts         # Supabaseクライアント
└── types/                  # TypeScript型定義
supabase/
└── migrations/             # DBマイグレーション
scripts/
└── screenshot.js           # スクショ取得スクリプト（GitHub Actions用）
docs/
└── PRD.md                  # プロダクト要件定義書 v2.2
```

## AI切替

環境変数 `AI_PROVIDER` を変更するだけで全AI処理が切り替わります。

```bash
# Phase 1（デフォルト）
AI_PROVIDER=gemini

# Phase 2（収益安定後）
AI_PROVIDER=claude
```

## ライセンス

Private
