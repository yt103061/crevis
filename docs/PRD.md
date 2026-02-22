# CreVis プロダクト要件定義書 v2.2

**AI二段階戦略版（2026-02-20）**

---

## 1. サービス概要と目的

CreVisは、日本のデザイナー・Webマーケターが「成果の出るLP」を素早く発見・参照できるAIネイティブなLPギャラリー＋ニュースレタープラットフォームです。

既存ギャラリーサイト（Sankou、Web Design Clip等）は「見た目の美しさ」軸でキュレーションされており、CVR・成果との相関が不明です。CreVisはAIによる構造分析・コピー評価・稼働期間推定を組み合わせて**成果推定スコア**を算出し、デザイン判断の根拠を提供します。

さらに英語圏（ConversionXL、Unbounce Blog、Nielsen Norman Group等）のCROデータ・LP研究を週次で自動収集・翻訳・配信するニュースレターにより、日本語でほぼ入手できなかった実証的なデザイン×マーケティング知見を届けます。

### ミッション

デザイナーが「なんとなく良さそう」から「根拠ある選択」へ移行できる環境を作る。

---

## 2. ターゲットユーザー

| 区分 | 対象 | 推定規模 |
|---|---|---|
| Primary（主） | 日本のUI/UX・Webデザイナー | 15〜20万人 |
| Secondary（副） | Webマーケター、LP制作担当のインハウスチーム | 10〜15万人 |

**想定ペルソナ：** 制作会社・フリーランスのデザイナー。参考LP探しに月2〜4時間消費。日本語でCRO情報を得る手段がなく困っている。

---

## 3. 収益計画

$$\text{Phase1目標MRR} = 50\text{名} \times ¥980 = ¥49{,}000/\text{月}$$

$$\text{損益分岐点} = \lceil ¥0 \div ¥980 \rceil = \textbf{1名}（Phase 1はコスト¥0）$$

| プラン | 価格 | 主な制限・特典 |
|---|---|---|
| Free | ¥0 | LP閲覧20件/月、NL受信のみ |
| Pro | ¥980/月 or ¥9,800/年 | 無制限閲覧、AIコメント全文、NL全文 |
| Team | ¥2,980/月（5名まで） | 共有コレクション、チームメモ |

---

## 4. 技術スタック（v2.2 改訂版）

| レイヤー | Phase 1（無料） | Phase 2以降（有料移行） | 移行トリガー |
|---|---|---|---|
| Frontend/Backend | Next.js 14 + Tailwind / Vercel Hobby | 同左（Vercel Pro） | 月間リクエスト激増時 |
| DB + Auth | Supabase Free | Supabase Pro ($25/月) | DB 500MB超過時 |
| 画像ストレージ | Cloudflare R2（無料10GB） | 同左（従量 $0.015/GB） | 10GB超過時 |
| スクショ取得 | GitHub Actions + Puppeteer（¥0） | 同左 or ScreenshotOne | 自動化量が増えた時 |
| AI分析・翻訳 | Gemini 2.5 Flash（無料） | Claude claude-sonnet-4-20250514 API（~¥100/月） | 収益発生後・任意 |
| メール配信 | Resend Free（3,000通/月） | Resend Pro ($20/月) | NL読者300人超過時 |
| 決済 | Stripe（手数料のみ 3.6%） | 同左 | 売上発生と同時 |
| デプロイ | Vercel Hobby | Vercel Pro | リクエスト増加時 |

$$\text{Phase 1 月額コスト} = ¥0$$

$$\text{Phase 2 月額コスト（50 Proユーザー時）} = \text{Stripe手数料のみ} \approx ¥1{,}764$$

$$\text{Phase 2 粗利} = ¥49{,}000 - ¥1{,}764 \approx ¥47{,}200/\text{月}$$

---

## 5. AI戦略：二段階設計（重要）

### なぜGemini無料→Claude有料の順番か

Gemini 2.5 Flash無料枠は2025年12月に無告知で92%削減（RPD: 250→20回/日）された実績があり、本番プロダクトに依存するにはリスクがあります。一方でCreVis Phase 1のAI処理量（LP分析1日数件＋週次NL記事処理5件）は現在の無料枠（RPD 20〜250回/日）に十分収まります。ただし無料枠利用時はデータがGoogleの学習に使用される点に注意が必要です（後述の対策を参照）。

収益が安定したタイミングで月¥100以下のClaude APIへ切り替えることで、データプライバシー・出力品質・安定性をすべて確保できます。

### 無料枠利用時のデータ取り扱い注意事項

Gemini API無料枠はGoogleの学習データとして利用されます。CreVisではLPのURL・構造情報・コピーテキストをAIに送信するため、第三者コンテンツを扱う観点から以下の対策を講じます。

- Gemini APIに送信するのはURL・業界・目的・推定稼働日数のみとし、LPの本文テキスト全体は送信しない
- スクリーンショット画像はGemini APIに送信せずR2に保存するのみとする
- Claude移行後はこの制限を撤廃し、より詳細な分析を可能にする

### AI APIを抽象化したラッパー実装

モデル切替を環境変数1つで管理する設計です（実装: `src/lib/ai-client.ts`）。

```typescript
// lib/ai-client.ts
const AI_PROVIDER = process.env.AI_PROVIDER ?? 'gemini' // 'gemini' | 'claude'

export async function analyzeLP(input: LPAnalysisInput): Promise<LPAnalysisOutput> {
  const prompt = buildLPAnalysisPrompt(input)
  const raw = AI_PROVIDER === 'claude'
    ? await callClaude(prompt)
    : await callGemini(prompt)
  return extractJSON(raw) as LPAnalysisOutput
}

export async function processNewsletterArticle(
  input: ArticleInput
): Promise<ArticleOutput> {
  const prompt = buildArticlePrompt(input)
  const raw = AI_PROVIDER === 'claude'
    ? await callClaude(prompt)
    : await callGemini(prompt)
  return extractJSON(raw) as ArticleOutput
}

// Gemini 2.5 Flash（無料枠）
async function callGemini(prompt: string): Promise<string> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  const result = await model.generateContent(prompt)
  return result.response.text()
}

// Claude claude-sonnet-4-20250514（Phase 2移行先）
async function callClaude(prompt: string): Promise<string> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })
  return (message.content[0] as { text: string }).text
}
```

環境変数`AI_PROVIDER`を`gemini`から`claude`に変更するだけで全AI処理が切り替わります。コードの改修は不要です。

---

## 6. データモデル

実装: `supabase/migrations/001_initial_schema.sql`

```sql
-- LPマスタ
create table lps (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text,
  industry text,
  purpose text,
  target_audience text,
  screenshot_url text,
  first_seen_at timestamptz default now(),
  last_checked_at timestamptz,
  ad_platform text,
  status text default 'active',
  created_at timestamptz default now()
);

-- AI分析結果
create table lp_analyses (
  id uuid primary key default gen_random_uuid(),
  lp_id uuid references lps(id),
  structure_score int,
  copy_score int,
  trust_score int,
  longevity_score int,
  total_score int,
  good_points jsonb,
  improvement_points jsonb,
  why_it_works text,
  target_match text,
  embedding vector(1536),
  analyzed_at timestamptz default now()
);

-- ユーザーコレクション
create table collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  lp_id uuid references lps(id),
  memo text,
  created_at timestamptz default now()
);

-- NLソース定義
create table nl_sources (
  id uuid primary key default gen_random_uuid(),
  name text,
  url text,
  type text,
  language text default 'en',
  active boolean default true,
  last_fetched_at timestamptz,
  created_at timestamptz default now()
);

-- NL記事候補
create table nl_articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references nl_sources(id),
  original_url text unique,
  original_title text,
  original_content text,
  summary_ja text,
  translated_title_ja text,
  key_insights jsonb,
  relevance_score int,
  status text default 'pending',
  fetched_at timestamptz default now()
);

-- NL号
create table newsletter_issues (
  id uuid primary key default gen_random_uuid(),
  issue_number int unique,
  title text,
  content_html text,
  featured_lps jsonb,
  featured_articles jsonb,
  status text default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count int,
  created_at timestamptz default now()
);

-- NL購読者
create table newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  plan text default 'free',
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz
);

-- ユーザープロフィール
create table profiles (
  id uuid primary key references auth.users(id),
  email text,
  plan text default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);
```

---

## 7. フェーズ別機能要件

### Phase 1 — MVP（目安：2〜3週間、月額コスト¥0）

#### LP登録ワークフロー（管理画面）

- 管理者がURL・業界・目的・ターゲット・発見元を入力してLPを登録
- 登録トリガーでGitHub Actions（Puppeteer）を起動しスクショ取得→R2保存
- Gemini 2.5 Flash APIに構造・コピー・信頼・稼働スコアとコメントをJSONで生成させDB保存
- 登録済みLP一覧（スコア順・登録日順ソート、フィルタ、ステータス変更、削除申請管理）

#### ニュースレターワークフロー（管理画面）

- NLソース管理（追加・編集・有効/無効切り替え）
- 「記事収集」ボタン：全有効ソースのRSSをフェッチ→Gemini 2.5 Flashで日本語要約・タイトル・インサイト生成→nl_articlesにinsert
- 記事一覧：関連度スコア順に表示。各記事にAI生成の日本語要約・タイトル・インサイト表示
- 記事ステータス操作：approved / rejected をワンクリックで変更
- 号作成：approved記事と今週のLP特集を選択→HTMLプレビュー生成→status: readyに変更
- 配信：Resend APIで全購読者に送信→status: sent・sent_at・recipient_countを記録

#### 公開側（ユーザー向け）

- `/`：LPギャラリー（フィルタ：業界・目的・ターゲット、ソート：スコア・新着）
- `/lp/[id]`：LP詳細（スクショ、レーダーチャート、AIコメント全文＊、元URL、コレクション追加）
- `/search`：テキスト検索（Phase 1はキーワードマッチ）
- `/newsletter`：バックナンバー一覧＋購読登録フォーム
- `/login`・`/dashboard`：認証・コレクション管理

＊AIコメント全文はProプランのみ。非ログイン・Freeはブラー表示。

### Phase 2 — 自動化・マネタイズ（Phase 1リリース後 1〜2ヶ月）

- Stripe統合（Pro / Teamプラン課金）
- Meta広告ライブラリAPI連携による自動LP収集（Supabase Edge Function定期実行）
- pgvectorを使った意味検索（自然言語でLP検索）
- LP稼働期間の自動更新バッチ
- AI_PROVIDERを`gemini`→`claude`へ切り替え（収益確認後、任意のタイミング）
- 管理画面にMRR・ユーザー数ダッシュボード追加

### Phase 3 — 拡張（Phase 2リリース後 1〜2ヶ月）

- チームワークスペース（共有コレクション・メモ）
- パーソナライズドレコメンド（閲覧履歴を基にAIがLP推薦）
- Proプラン限定ニュースレターコンテンツ（詳細分析・事例深掘り）
- 将来的なAPI提供

---

## 8. 管理画面 詳細UI仕様

```
/admin
├── /admin/dashboard          # KPI概要（LP数・NL購読者数・MRR・AI使用状況）
├── /admin/lps                # LP一覧・管理
│   ├── 一覧テーブル（URL, タイトル, スコア, 業界, 登録日, ステータス）
│   ├── フィルタ・ソート
│   ├── 個別操作（分析再実行・アーカイブ・削除申請処理）
│   └── /admin/lps/new        # LP新規登録フォーム
├── /admin/newsletter
│   ├── /admin/newsletter/sources      # ソース管理（CRUD）
│   ├── /admin/newsletter/articles     # 記事一覧・approve/reject
│   ├── /admin/newsletter/issues       # 号一覧（新規作成・編集・配信）
│   └── /admin/newsletter/subscribers  # 購読者一覧
└── /admin/settings           # 環境設定・AI_PROVIDER確認・APIキー状態表示
```

---

## 9. AI プロンプト仕様

Gemini / Claude 共通で同一プロンプトを使用します。

### LP分析プロンプト（JSON出力）

```
以下のランディングページ情報を分析し、JSON形式で返してください。

URL: {url}
業界: {industry}
目的: {purpose}
ターゲット: {target_audience}
推定稼働日数: {days_active}

返却JSON形式:
{
  "structure_score": 0-100,
  "copy_score": 0-100,
  "trust_score": 0-100,
  "longevity_score": 0-100,
  "total_score": 0-100,
  "good_points": ["...", "...", "..."],
  "improvement_points": ["...", "..."],
  "why_it_works": "...",
  "target_match": "..."
}
```

### NL記事処理プロンプト（JSON出力）

```
以下の英語記事を日本のデザイナー・Webマーケター向けに日本語で要約してください。

タイトル: {original_title}
本文: {original_content}

返却JSON形式:
{
  "translated_title_ja": "...",
  "summary_ja": "200字程度の日本語要約",
  "key_insights": ["インサイト1", "インサイト2", "インサイト3"],
  "relevance_score": 0-100
}
```

---

## 10. スクショ取得 GitHub Actions ワークフロー仕様

実装: `.github/workflows/screenshot.yml` + `scripts/screenshot.js`

```yaml
name: Take LP Screenshot
on:
  workflow_dispatch:
    inputs:
      lp_id:
        description: 'LP ID in Supabase'
        required: true
      url:
        description: 'Target URL'
        required: true

jobs:
  screenshot:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install puppeteer @aws-sdk/client-s3 @supabase/supabase-js
      - name: Take screenshot and upload to R2
        env:
          R2_ACCOUNT_ID: ${{ secrets.R2_ACCOUNT_ID }}
          R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
          R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
          R2_BUCKET_NAME: ${{ secrets.R2_BUCKET_NAME }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: node scripts/screenshot.js ${{ inputs.lp_id }} "${{ inputs.url }}"
```

---

## 11. 非機能要件

- **パフォーマンス：** LP一覧初期表示2秒以内、1ページ20件
- **セキュリティ：** Supabase RLS全テーブル適用、管理画面はADMIN_EMAILによるサーバーサイド認証
- **著作権対応：** 元URL必須表示、削除申請フォーム設置（status: takedownで対応）
- **SEO：** OGP・sitemap.xml・robots.txt設定、管理画面はnoindex
- **AI切替対応：** `AI_PROVIDER`の変更のみで全AI処理が切り替わる設計を維持する

---

## 12. 環境変数一覧（v2.2 更新）

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI設定（'gemini' または 'claude'）
AI_PROVIDER=gemini

# Phase 1: Gemini（無料）
GEMINI_API_KEY=

# Phase 2以降: Claude（任意タイミングで切替）
ANTHROPIC_API_KEY=

# ストレージ
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=

# メール
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# 決済（Phase 2〜）
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# GitHub Actions連携（スクショ取得ワークフロー）
GITHUB_TOKEN=
GITHUB_REPO=

# 管理
ADMIN_EMAIL=
NEXT_PUBLIC_APP_URL=
```

---

## 13. Phase 1 実装ステップ（Claude Code投入順）

1. プロジェクト初期化（Next.js 14 + Tailwind + Supabase CLI）
2. DBマイグレーション（上記SQLを`supabase/migrations/`に配置）
3. `lib/ai-client.ts`作成（Gemini/Claude切替ラッパー）
4. GitHub ActionsスクショワークフローとR2アップロードスクリプト作成
5. LP登録API（`/api/admin/lps/create`）：GitHub Actionsトリガー → AI分析 → DB保存
6. 管理画面UI（`/admin/lps`・`/admin/lps/new`）
7. NL記事収集API（`/api/admin/nl/fetch`）：RSS取得 → AI処理 → DB保存
8. 管理画面UI（`/admin/newsletter/articles`・`/admin/newsletter/issues`）
9. 公開側ギャラリー・詳細・検索ページ
10. Supabase Auth + コレクション機能
11. Resend NL配信実装
12. Vercelデプロイ・環境変数設定（`AI_PROVIDER=gemini`でスタート）

---

## 14. スケールアップ時の課金トリガー目安

| タイミング | 対応 | 月額追加コスト |
|---|---|---|
| 収益が安定したら | `AI_PROVIDER=claude`に変更 | ~¥100 |
| NL読者300人超 | Resend Pro | +¥3,000 |
| DB 500MB超 | Supabase Pro | +¥3,750 |
| 画像10GB超 | R2従量課金 | +¥150/GB |
| リクエスト激増 | Vercel Pro | +¥3,000 |

すべての課金は収益発生後に後追いで発生する設計です。先行投資¥0でスタートできます。

---

## 15. 実装ステータス（現在のコードベースとの対応）

| 項目 | ステータス | 実装ファイル |
|---|---|---|
| プロジェクト初期化 | 完了 | `package.json`, `next.config.mjs`, `tsconfig.json` |
| DBマイグレーション | 完了 | `supabase/migrations/001_initial_schema.sql` |
| AI切替ラッパー | 完了 | `src/lib/ai-client.ts` |
| 型定義 | 完了 | `src/types/index.ts` |
| Supabaseクライアント | 完了 | `src/lib/supabase.ts` |
| 認証ヘルパー | 完了 | `src/lib/auth.ts` |
| R2クライアント | 完了 | `src/lib/r2.ts` |
| ユーティリティ | 完了 | `src/lib/utils.ts` |
| スクショワークフロー | 完了 | `.github/workflows/screenshot.yml`, `scripts/screenshot.js` |
| LP登録API | 完了 | `src/app/api/admin/lps/create/route.ts` |
| LP管理API | 完了 | `src/app/api/admin/lps/[id]/route.ts` |
| NL記事収集API | 完了 | `src/app/api/admin/nl/fetch/route.ts` |
| NLソースAPI | 完了 | `src/app/api/admin/nl/sources/route.ts`, `[id]/route.ts` |
| NL号API | 完了 | `src/app/api/admin/nl/issues/route.ts`, `[id]/route.ts` |
| NL記事ステータスAPI | 完了 | `src/app/api/admin/nl/articles/[id]/route.ts` |
| NL購読API | 完了 | `src/app/api/newsletter/subscribe/route.ts` |
| コレクションAPI | 完了 | `src/app/api/collections/route.ts` |
| 管理画面ダッシュボード | 完了 | `src/app/admin/page.tsx` |
| 管理画面レイアウト | 完了 | `src/app/admin/layout.tsx` |
| LP一覧（管理） | 完了 | `src/app/admin/lps/page.tsx` |
| LP登録フォーム | 完了 | `src/app/admin/lps/new/page.tsx` |
| NLソース管理 | 完了 | `src/app/admin/newsletter/sources/page.tsx` |
| NL記事管理 | 完了 | `src/app/admin/newsletter/articles/page.tsx` |
| NL号管理 | 完了 | `src/app/admin/newsletter/issues/page.tsx` |
| NL購読者管理 | 完了 | `src/app/admin/newsletter/subscribers/page.tsx` |
| 設定画面 | 完了 | `src/app/admin/settings/page.tsx` |
| 公開ギャラリー | 完了 | `src/app/page.tsx` |
| LP詳細 | 完了 | `src/app/lp/[id]/page.tsx` |
| 検索 | 完了 | `src/app/search/page.tsx` |
| ニュースレター | 完了 | `src/app/newsletter/page.tsx` |
| ログイン | 完了 | `src/app/login/page.tsx` |
| ダッシュボード | 完了 | `src/app/dashboard/page.tsx` |
| Auth Callback | 完了 | `src/app/auth/callback/route.ts` |
| ミドルウェア | 完了 | `src/middleware.ts` |
| SEO（sitemap/robots） | 完了 | `src/app/sitemap.ts`, `src/app/robots.ts` |
| Vercel設定 | 完了 | `vercel.json` |
| 環境変数テンプレート | 完了 | `.env.local.example` |
