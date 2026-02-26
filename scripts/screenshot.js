#!/usr/bin/env node
/**
 * LPスクリーンショット取得スクリプト
 * 使い方: node scripts/screenshot.js <lp_id> <url>
 * スクリーンショット取得に加え、DOM解析データ（ページ高さ・ロード時間等）も保存する
 */

const puppeteer = require('puppeteer')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { createClient } = require('@supabase/supabase-js')

const lpId = process.argv[2]
const url = process.argv[3]

if (!lpId || !url) {
  console.error('Usage: node screenshot.js <lp_id> <url>')
  process.exit(1)
}

async function takeScreenshot() {
  console.log(`Taking screenshot for LP ${lpId}: ${url}`)

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  let screenshotBuffer
  let domAnalysis = null

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })

    const navStart = Date.now()
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })
    const pageLoadTimeMs = Date.now() - navStart

    const bodyHeight = await page.evaluate(() =>
      Math.min(document.body.scrollHeight, 5000)
    )
    const pageHeightRatio = bodyHeight / 900

    await page.setViewport({ width: 1280, height: bodyHeight })

    // DOM解析: ページ構造情報を取得
    try {
      domAnalysis = await page.evaluate(() => {
        const getText = (el) => el ? el.textContent.trim() : ''

        // 基本情報
        const title = document.title || ''
        const h1Text = getText(document.querySelector('h1'))
        const h2Texts = Array.from(document.querySelectorAll('h2'))
          .map((el) => el.textContent.trim())
          .filter(Boolean)
          .slice(0, 10)

        // CTA検出
        const ctaWords = ['無料', '申し込む', '登録', '始める', '試す', '体験', '問い合わせ', '資料請求',
          'Start', 'Get Started', 'Sign Up', 'Try', 'Free', 'Download', 'Contact', 'Get', 'Buy']
        const ctaButtons = []
        document.querySelectorAll('button, a.btn, a.button, [class*="cta"], input[type="submit"]')
          .forEach((el) => {
            const text = el.textContent.trim()
            if (text && ctaWords.some((w) => text.includes(w))) {
              ctaButtons.push(text.slice(0, 50))
            }
          })

        // フォーム
        const forms = document.querySelectorAll('form')
        const hasMainForm = forms.length > 0
        let formFieldCount = 0
        forms.forEach((form) => {
          formFieldCount += form.querySelectorAll(
            'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
          ).length
        })

        // ナビゲーション
        const navLinkCount = document.querySelectorAll('nav a, header a').length

        // 信頼シグナル
        const bodyText = document.body.innerText || ''
        const hasSocialProof = /導入企業|導入実績|利用者数|会員数|\d+社|\d+人|customers|companies|users/i.test(bodyText)
        const hasTestimonials = /お客様の声|導入事例|testimonial|review|★|⭐/i.test(bodyText) ||
          document.querySelectorAll('[class*="testimonial"], [class*="review"], [class*="voice"]').length > 0
        const hasFAQ = /よくある質問|FAQ|Q&A|frequently asked/i.test(bodyText) ||
          document.querySelectorAll('[class*="faq"], [class*="accordion"]').length > 0
        const hasPricing = /料金|価格|プラン|pricing|plan|\$/i.test(bodyText) ||
          document.querySelectorAll('[class*="price"], [class*="plan"], [class*="pricing"]').length > 0

        // 画像・動画
        const totalImageCount = document.querySelectorAll('img').length
        const hasVideo = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0

        // セクション数
        const totalSections = document.querySelectorAll('section, [class*="section"], [class*="block"]').length

        return {
          h1Text,
          h2Texts,
          ctaButtons: ctaButtons.slice(0, 10),
          hasMainForm,
          formFieldCount,
          navLinkCount,
          hasSocialProof,
          hasTestimonials,
          hasFAQ,
          hasPricing,
          totalImageCount,
          hasVideo,
          totalSections,
        }
      })

      domAnalysis.pageLoadTimeMs = pageLoadTimeMs
      domAnalysis.pageHeightRatio = Math.round(pageHeightRatio * 100) / 100
    } catch (domErr) {
      console.warn('DOM analysis failed:', domErr.message)
    }

    screenshotBuffer = await page.screenshot({
      type: 'webp',
      quality: 85,
      fullPage: false,
    })
  } finally {
    await browser.close()
  }

  // R2にアップロード
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  })

  const key = `screenshots/${lpId}.webp`
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: screenshotBuffer,
      ContentType: 'image/webp',
    })
  )

  const publicUrl = process.env.R2_PUBLIC_URL
  const screenshotUrl = publicUrl
    ? `${publicUrl}/${key}`
    : `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`

  console.log(`Screenshot uploaded: ${screenshotUrl}`)

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // スクリーンショットURLをLPに保存
  const { error: lpError } = await supabase
    .from('lps')
    .update({ screenshot_url: screenshotUrl, last_checked_at: new Date().toISOString() })
    .eq('id', lpId)

  if (lpError) {
    console.error('Failed to update Supabase lps:', lpError)
    process.exit(1)
  }

  // DOM解析結果をlp_page_featuresにupsert
  if (domAnalysis) {
    try {
      const { error: featError } = await supabase
        .from('lp_page_features')
        .upsert(
          {
            lp_id: lpId,
            h1_text: domAnalysis.h1Text,
            h2_texts: domAnalysis.h2Texts,
            cta_buttons: domAnalysis.ctaButtons,
            has_main_form: domAnalysis.hasMainForm,
            form_field_count: domAnalysis.formFieldCount,
            nav_link_count: domAnalysis.navLinkCount,
            has_social_proof: domAnalysis.hasSocialProof,
            has_testimonials: domAnalysis.hasTestimonials,
            has_faq: domAnalysis.hasFAQ,
            has_pricing: domAnalysis.hasPricing,
            total_image_count: domAnalysis.totalImageCount,
            has_video: domAnalysis.hasVideo,
            total_sections: domAnalysis.totalSections,
            page_load_time_ms: domAnalysis.pageLoadTimeMs,
            page_height_ratio: domAnalysis.pageHeightRatio,
          },
          { onConflict: 'lp_id' }
        )
      if (featError) {
        console.warn('Failed to upsert lp_page_features:', featError.message)
      } else {
        console.log('DOM analysis saved to lp_page_features')
      }
    } catch (e) {
      console.warn('lp_page_features upsert error:', e.message)
    }
  }

  console.log(`Successfully updated LP ${lpId} with screenshot URL`)
}

takeScreenshot().catch((err) => {
  console.error('Screenshot failed:', err)
  process.exit(1)
})
