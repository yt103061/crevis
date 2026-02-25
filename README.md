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

## Roadmap

- 自動化ロードマップ提案（ニュースレター完全自動化 / LP自動収集）:
  - `docs/automation-phase-plan.md`

## AI切替

環境変数 `AI_PROVIDER` を変更するだけで全AI処理が切り替わります。

```bash
# Phase 1（デフォルト）
AI_PROVIDER=gemini

# Phase 2（収益安定後）
AI_PROVIDER=claude
```


## 自動化設定（LP/NL）

- `LP_DISCOVERY_FEEDS` を未設定にすると、安定運用を優先したプロダクト新着系フィード（Product Hunt / Indie Hackers / HN / Kickstarter）を利用してLP候補を自動収集します（`LP_DISCOVERY_USE_DEFAULT_FEEDS=true` 時）。
- `NL_FETCH_AUTO_SEED_SOURCES=true` の場合、ニュースレター収集時に推奨RSSソース（CXL / Unbounce / NNgroup など海外CRO + 国内有力媒体）を `nl_sources` へ自動投入します（既定はアクティブソースが0件のときのみ。`NL_FETCH_AUTO_SEED_ON_EMPTY_ONLY=true`）。
- NL収集時はフィード取得を `parseURL` → `fetch + parseString` でフォールバックし、AI要約失敗時も記事自体は保存（`aiFallbacks`）します。
- Vercel Cron は以下を想定します。
  - `/api/cron/lp-discover` : 毎日1回
  - `/api/cron/nl-fetch` : 毎日1回（Hobby制限対応）
  - `/api/cron/nl-issue` : 毎週木曜
- LP収集では URL/タイトル/ソース重みを使ったヒューリスティック判定を実施し、`LP_DISCOVERY_MIN_HEURISTIC_SCORE` 未満は除外します。`LP_DISCOVERY_JP_ONLY=true` で日本向けドメインに絞り、`LP_DISCOVERY_REQUIRE_PERFORMANCE_SIGNAL=true` で成果シグナル（CVR/導入実績/事例等）を含む候補を優先します。
- フィード取得失敗時は `parseURL` → `fetch + parseString` の順でフォールバックし、管理画面にフィードエラー件数/詳細を表示します。

## ライセンス

Private
