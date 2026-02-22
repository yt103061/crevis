# CreVis 外部サービス セットアップガイド

このガイドでは、CreVisを動作させるために必要な各外部サービスの登録・設定手順を説明します。

---

## 目次

1. [Supabase（DB + 認証）](#1-supabasedb--認証)
2. [Gemini API（AI分析）](#2-gemini-apiai分析)
3. [Cloudflare R2（画像ストレージ）](#3-cloudflare-r2画像ストレージ)
4. [Resend（メール配信）](#4-resendメール配信)
5. [GitHub Actions（スクショ自動取得）](#5-github-actionsスクショ自動取得)
6. [Vercel（デプロイ）](#6-vercelデプロイ)
7. [Stripe（決済 / Phase 2）](#7-stripe決済--phase-2)
8. [Anthropic Claude API（Phase 2）](#8-anthropic-claude-apiphase-2)

---

## 1. Supabase（DB + 認証）

### 取得する値

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### 手順

1. https://supabase.com にアクセスし「Start your project」をクリック
2. GitHubアカウントでサインアップ（またはメールで登録）
3. ダッシュボードで「New Project」をクリック
4. 以下を入力して作成
   - **Organization:** 自分の組織を選択（なければ作成）
   - **Project name:** `crevis`（任意）
   - **Database Password:** 強力なパスワードを設定（メモしておく）
   - **Region:** `Northeast Asia (Tokyo)` を選択
   - **Pricing Plan:** Free を選択
5. プロジェクト作成完了まで数分待つ

### URL・キーの取得場所

1. Supabaseダッシュボード → 左メニュー「**Project Settings**」（歯車アイコン）
2. 「**API**」タブをクリック
3. 以下の値をコピー

| 項目 | `.env.local`の変数名 | 場所 |
|---|---|---|
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` | 「Project URL」欄 |
| anon public | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 「Project API keys」→「anon」「public」 |
| service_role | `SUPABASE_SERVICE_ROLE_KEY` | 「Project API keys」→「service_role」「secret」（Revealをクリック） |

> **注意:** `service_role`キーは管理者権限を持つため、フロントエンドに公開しないでください。

### DBマイグレーション実行

1. Supabaseダッシュボード → 左メニュー「**SQL Editor**」
2. 「New query」をクリック
3. `supabase/migrations/001_initial_schema.sql` の内容をすべて貼り付け
4. 「Run」をクリック
5. 「Success. No rows returned」と表示されれば完了

### 認証プロバイダ設定（Google / GitHubログインを使う場合）

1. ダッシュボード → 左メニュー「**Authentication**」
2. 「**Providers**」タブ
3. 使いたいプロバイダ（例: Google）を有効化
4. 各プロバイダのOAuth Client IDとSecretを設定
   - Google の場合: https://console.cloud.google.com で OAuth 2.0 クライアントを作成
   - Redirect URI に `https://<your-supabase-url>/auth/v1/callback` を登録

メール/パスワード認証はデフォルトで有効です。Phase 1はこれだけでも十分です。

---

## 2. Gemini API（AI分析）

### 取得する値

```
AI_PROVIDER=gemini
GEMINI_API_KEY=
```

### 手順

1. https://aistudio.google.com にアクセス
2. Googleアカウントでログイン
3. 左メニューまたはヘッダーの「**Get API key**」をクリック
4. 「**Create API key**」をクリック
5. 既存のGCPプロジェクトを選択、またはGoogle AI Studio用のプロジェクトを新規作成
6. APIキーが生成されるのでコピー → `GEMINI_API_KEY` に設定

### 無料枠の確認

- https://aistudio.google.com → 左メニュー → 「API keys」でキーの使用状況を確認可能
- 無料枠の制限（2026年2月時点の目安）:
  - **RPM（1分あたりリクエスト数）:** 15回
  - **RPD（1日あたりリクエスト数）:** 1,500回
  - **TPM（1分あたりトークン数）:** 100万トークン
- CreVis Phase 1の使用量（LP分析数件/日 + NL記事5件/週）は十分に収まる

### 注意事項

- 無料枠のデータはGoogleの学習に使用される可能性がある
- CreVisでは対策として、LPの本文テキスト全体は送信せず、URL・業界・目的・推定稼働日数のみを送信する設計

---

## 3. Cloudflare R2（画像ストレージ）

### 取得する値

```
CLOUDFLARE_R2_ACCOUNT_ID=
CLOUDFLARE_R2_ACCESS_KEY_ID=
CLOUDFLARE_R2_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
```

### 手順

#### 3-1. Cloudflareアカウント作成

1. https://dash.cloudflare.com/sign-up にアクセス
2. メールアドレスとパスワードで登録
3. メール認証を完了

#### 3-2. R2を有効化

1. Cloudflareダッシュボード → 左メニュー「**R2 Object Storage**」
2. 初回の場合は「Get Started」で支払い方法を登録（無料枠内なら課金なし）
   - クレジットカードの登録は必要だが、10GB/月まで無料

#### 3-3. バケット作成

1. R2ページで「**Create bucket**」をクリック
2. **Bucket name:** `crevis-screenshots`（任意）
3. **Location:** `Asia Pacific` を選択
4. 「Create bucket」をクリック

#### 3-4. Account IDの取得

1. Cloudflareダッシュボード → 右側のサイドバーまたはURLバーを確認
2. URLが `https://dash.cloudflare.com/<account_id>/...` の形式
3. この `<account_id>` が `CLOUDFLARE_R2_ACCOUNT_ID`

#### 3-5. APIトークン（アクセスキー）の作成

1. R2ページ → 「**Manage R2 API Tokens**」をクリック（または「R2 Overview」→ 「Manage API tokens」）
2. 「**Create API token**」をクリック
3. 設定:
   - **Token name:** `crevis-r2-access`（任意）
   - **Permissions:** 「Object Read & Write」
   - **Specify bucket(s):** 作成したバケット（`crevis-screenshots`）を選択
4. 「Create API Token」をクリック
5. 表示される値をコピー:

| 表示名 | `.env.local`の変数名 |
|---|---|
| Access Key ID | `CLOUDFLARE_R2_ACCESS_KEY_ID` |
| Secret Access Key | `CLOUDFLARE_R2_SECRET_ACCESS_KEY` |

> **注意:** Secret Access Keyはこの画面でしか表示されません。必ずコピーして安全に保管してください。

#### 3-6. パブリックアクセス設定（任意）

スクリーンショットを公開URLで配信する場合:

1. バケット設定 → 「**Settings**」タブ
2. 「**Public access**」→ 「Allow Access」を有効化
3. カスタムドメインを設定するか、`r2.dev`サブドメインを有効化

---

## 4. Resend（メール配信）

### 取得する値

```
RESEND_API_KEY=
RESEND_FROM_EMAIL=
```

### 手順

#### 4-1. アカウント作成

1. https://resend.com にアクセス
2. 「Get Started」をクリック
3. GitHubアカウントまたはメールで登録

#### 4-2. APIキー取得

1. ダッシュボード → 左メニュー「**API Keys**」
2. 「**Create API Key**」をクリック
3. 設定:
   - **Name:** `crevis-production`（任意）
   - **Permission:** 「Full access」
   - **Domain:** 「All domains」
4. 「Add」をクリック
5. 表示されるAPIキーをコピー → `RESEND_API_KEY` に設定

> **注意:** APIキーはこの画面でしか表示されません。

#### 4-3. 送信元ドメイン設定

**テスト用（ドメインなし）の場合:**

- `RESEND_FROM_EMAIL=onboarding@resend.dev` を設定
- この場合、自分のメールアドレスにしか送信できない（テスト用）

**本番運用する場合:**

1. ダッシュボード → 左メニュー「**Domains**」
2. 「**Add Domain**」をクリック
3. 独自ドメイン（例: `crevis.jp`）を入力
4. 表示されるDNSレコード（MX, TXT, CNAME）をドメインのDNS設定に追加
5. 「Verify」をクリックして認証完了を待つ（数分〜数時間）
6. 認証完了後、`RESEND_FROM_EMAIL=newsletter@crevis.jp` のように設定

### 無料枠

- 月3,000通まで無料
- 1日100通まで
- CreVis Phase 1（購読者300人未満）では十分

---

## 5. GitHub Actions（スクショ自動取得）

### 取得する値

```
GITHUB_TOKEN=
GITHUB_REPO=
```

### 手順

#### 5-1. Personal Access Token (PAT) の作成

1. https://github.com/settings/tokens?type=beta にアクセス（Fine-grained tokens）
2. 「**Generate new token**」をクリック
3. 設定:
   - **Token name:** `crevis-actions`
   - **Expiration:** 90日（または任意）
   - **Repository access:** 「Only select repositories」→ CreVisリポジトリを選択
   - **Permissions → Repository permissions:**
     - **Actions:** Read and write
     - **Contents:** Read
4. 「Generate token」をクリック
5. 表示されるトークンをコピー → `GITHUB_TOKEN` に設定

#### 5-2. GITHUB_REPOの設定

- `GITHUB_REPO` にはリポジトリの `owner/repo` 形式を設定
- 例: `GITHUB_REPO=yt103061/crevis`

#### 5-3. リポジトリのSecretsに環境変数を登録

GitHub Actionsワークフロー内で使われるSecrets:

1. GitHubリポジトリ → 「**Settings**」→ 「**Secrets and variables**」→ 「**Actions**」
2. 「**New repository secret**」で以下を追加:

| Secret名 | 値 |
|---|---|
| `R2_ACCOUNT_ID` | Cloudflare R2のAccount ID |
| `R2_ACCESS_KEY_ID` | R2のAccess Key ID |
| `R2_SECRET_ACCESS_KEY` | R2のSecret Access Key |
| `R2_BUCKET_NAME` | バケット名（例: `crevis-screenshots`） |
| `SUPABASE_URL` | SupabaseのProject URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabaseのservice_roleキー |

---

## 6. Vercel（デプロイ）

### 手順

#### 6-1. アカウント作成とプロジェクト接続

1. https://vercel.com にアクセス
2. GitHubアカウントでサインアップ
3. 「**Add New…**」→「**Project**」をクリック
4. GitHubリポジトリ「crevis」を「Import」

#### 6-2. 環境変数の設定

1. プロジェクト設定 → 「**Environment Variables**」
2. `.env.local` と同じ環境変数をすべて追加:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
AI_PROVIDER=gemini
GEMINI_API_KEY=AIza...
CLOUDFLARE_R2_ACCOUNT_ID=xxxxx
CLOUDFLARE_R2_ACCESS_KEY_ID=xxxxx
CLOUDFLARE_R2_SECRET_ACCESS_KEY=xxxxx
CLOUDFLARE_R2_BUCKET_NAME=crevis-screenshots
RESEND_API_KEY=re_xxxxx
RESEND_FROM_EMAIL=newsletter@crevis.jp
GITHUB_TOKEN=github_pat_xxxxx
GITHUB_REPO=yt103061/crevis
ADMIN_EMAIL=your-email@example.com
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

3. 「Deploy」をクリック

#### 6-3. ADMIN_EMAILについて

- `ADMIN_EMAIL` には管理画面にアクセスできるユーザーのメールアドレスを設定
- Supabase Authでログインした際のメールアドレスと一致させる必要がある
- この値が一致しないと`/admin`にアクセスできない

#### 6-4. カスタムドメイン設定（任意）

1. Vercelダッシュボード → プロジェクト → 「**Settings**」→「**Domains**」
2. 独自ドメインを入力（例: `crevis.jp`）
3. 表示されるDNSレコードをドメインのDNS設定に追加
4. 設定後、`NEXT_PUBLIC_APP_URL` を更新

---

## 7. Stripe（決済 / Phase 2）

Phase 2で課金機能を追加する際に設定します。Phase 1では不要です。

### 取得する値

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

### 手順

1. https://stripe.com にアクセスしてアカウント作成
2. 本番利用には本人確認（銀行口座登録）が必要
3. ダッシュボード → 「**Developers**」→「**API keys**」
4. 以下をコピー:

| 項目 | `.env.local`の変数名 |
|---|---|
| Publishable key (`pk_test_...` or `pk_live_...`) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| Secret key (`sk_test_...` or `sk_live_...`) | `STRIPE_SECRET_KEY` |

5. Webhook設定:
   - 「Developers」→「Webhooks」→「Add endpoint」
   - URL: `https://your-app.vercel.app/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - 「Signing secret」をコピー → `STRIPE_WEBHOOK_SECRET`

> **テスト時のヒント:** `pk_test_` / `sk_test_` から始まるテストキーを使えば実際の課金なしでテストできます。

---

## 8. Anthropic Claude API（Phase 2）

Phase 2で収益が安定した後に切り替えます。Phase 1では不要です。

### 取得する値

```
AI_PROVIDER=claude
ANTHROPIC_API_KEY=
```

### 手順

1. https://console.anthropic.com にアクセス
2. アカウント作成（メールアドレスで登録）
3. クレジットカードを登録（従量課金制）
4. 左メニュー「**API Keys**」→「**Create Key**」をクリック
5. キー名を入力して作成
6. 表示されるAPIキー（`sk-ant-...`）をコピー → `ANTHROPIC_API_KEY` に設定
7. `.env.local` で `AI_PROVIDER=claude` に変更

### 料金目安

- Claude claude-sonnet-4-20250514: Input $3/MTok, Output $15/MTok
- CreVisの使用量（LP分析数件/日 + NL記事5件/週）では月¥100以下

---

## セットアップ優先順位

すべてを一度に設定する必要はありません。以下の順番で段階的に進められます。

### まず動かす（最小構成）

1. **Supabase** — DB・認証がないとアプリが動かない
2. **Gemini API** — AI分析機能に必要
3. `.env.local` に `ADMIN_EMAIL` を設定

この3つで `npm run dev` によるローカル開発が可能になります。

### 次に追加

4. **Cloudflare R2** — LPスクリーンショットの保存
5. **Resend** — ニュースレター配信

### 本番公開時

6. **Vercel** — デプロイ
7. **GitHub Actions Secrets** — スクショ自動取得

### 収益化時（Phase 2）

8. **Stripe** — 決済
9. **Anthropic Claude** — AI切り替え
