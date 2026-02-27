#!/usr/bin/env node
/**
 * LPスクリーンショット取得スクリプト
 * 使い方:
 *   単体: node scripts/screenshot.js <lp_id> <url>
 *   一括: node scripts/screenshot.js --batch   (screenshot_url IS NULL の LP を全件処理)
 * スクリーンショット取得に加え、DOM解析データ（ページ高さ・ロード時間等）も保存する
 */

// .env.local を自動ロード（ローカル実行時。CI/GitHub Actions では env: で渡す）
const path = require('path')
const fs = require('fs')
const envPath = path.resolve(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath })
}

const puppeteer = require('puppeteer')
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3')
const { createClient } = require('@supabase/supabase-js')

const isBatch = process.argv[2] === '--batch'
const lpId = !isBatch ? process.argv[2] : null
const url = !isBatch ? process.argv[3] : null

if (!isBatch && (!lpId || !url)) {
  console.error('Usage:')
  console.error('  Single: node scripts/screenshot.js <lp_id> <url>')
  console.error('  Batch:  node scripts/screenshot.js --batch')
  process.exit(1)
}

// 必須環境変数チェック
const REQUIRED_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET_NAME',
]
const missing = REQUIRED_VARS.filter((v) => !process.env[v])
if (missing.length > 0) {
  console.error('Missing required environment variables:')
  missing.forEach((v) => console.error(`  - ${v}`))
  console.error('\nCreate .env.local with these values, or set them in your environment.')
  process.exit(1)
}

function createR2Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  })
}

function createSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  return createClient(
    supabaseUrl,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function captureAndAnalyze(browser, targetUrl) {
  // --- デスクトップ ---
  const desktopPage = await browser.newPage()
  await desktopPage.setViewport({ width: 1280, height: 900 })

  const navStart = Date.now()
  await desktopPage.goto(targetUrl, {
    waitUntil: 'networkidle2',
    timeout: 30000,
  })
  const pageLoadTimeMs = Date.now() - navStart

  const bodyHeight = await desktopPage.evaluate(() =>
    Math.min(document.body.scrollHeight, 5000)
  )
  const pageHeightRatio = bodyHeight / 900

  await desktopPage.setViewport({ width: 1280, height: bodyHeight })

  // DOM解析: ページ構造情報を取得
  let domAnalysis = null
  try {
    domAnalysis = await desktopPage.evaluate(() => {
      const getText = (el) => el ? el.textContent.trim() : ''

      const h1Text = getText(document.querySelector('h1'))
      const h2Texts = Array.from(document.querySelectorAll('h2'))
        .map((el) => el.textContent.trim())
        .filter(Boolean)
        .slice(0, 10)

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

      const forms = document.querySelectorAll('form')
      const hasMainForm = forms.length > 0
      let formFieldCount = 0
      forms.forEach((form) => {
        formFieldCount += form.querySelectorAll(
          'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'
        ).length
      })

      const navLinkCount = document.querySelectorAll('nav a, header a').length

      const bodyText = document.body.innerText || ''
      const hasSocialProof = /導入企業|導入実績|利用者数|会員数|\d+社|\d+人|customers|companies|users/i.test(bodyText)
      const hasTestimonials = /お客様の声|導入事例|testimonial|review|★|⭐/i.test(bodyText) ||
        document.querySelectorAll('[class*="testimonial"], [class*="review"], [class*="voice"]').length > 0
      const hasFAQ = /よくある質問|FAQ|Q&A|frequently asked/i.test(bodyText) ||
        document.querySelectorAll('[class*="faq"], [class*="accordion"]').length > 0
      const hasPricing = /料金|価格|プラン|pricing|plan|\$/i.test(bodyText) ||
        document.querySelectorAll('[class*="price"], [class*="plan"], [class*="pricing"]').length > 0

      const totalImageCount = document.querySelectorAll('img').length
      const hasVideo = document.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]').length > 0
      const totalSections = document.querySelectorAll('section, [class*="section"], [class*="block"]').length

      return {
        h1Text, h2Texts,
        ctaButtons: ctaButtons.slice(0, 10),
        hasMainForm, formFieldCount, navLinkCount,
        hasSocialProof, hasTestimonials, hasFAQ, hasPricing,
        totalImageCount, hasVideo, totalSections,
      }
    })
    domAnalysis.pageLoadTimeMs = pageLoadTimeMs
    domAnalysis.pageHeightRatio = Math.round(pageHeightRatio * 100) / 100
  } catch (domErr) {
    console.warn('DOM analysis failed:', domErr.message)
  }

  const desktopScreenshotBuffer = await desktopPage.screenshot({
    type: 'webp',
    quality: 85,
    fullPage: false,
  })
  await desktopPage.close()

  // --- モバイル ---
  const mobilePage = await browser.newPage()
  await mobilePage.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  let mobileScreenshotBuffer = null
  try {
    await mobilePage.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 })
    const mobileBodyHeight = await mobilePage.evaluate(() => Math.min(document.body.scrollHeight, 8000))
    await mobilePage.setViewport({ width: 375, height: Math.min(mobileBodyHeight, 8000), deviceScaleFactor: 2, isMobile: true, hasTouch: true })
    mobileScreenshotBuffer = await mobilePage.screenshot({ type: 'webp', quality: 85, fullPage: false })
  } catch (e) {
    console.warn(`Mobile page load warning for ${targetUrl}:`, e.message)
  }
  await mobilePage.close()

  return { desktopScreenshotBuffer, mobileScreenshotBuffer, domAnalysis }
}

async function processLP(supabase, r2, targetLpId, targetUrl) {
  console.log(`Processing LP ${targetLpId}: ${targetUrl}`)

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  let desktopScreenshotBuffer
  let mobileScreenshotBuffer
  let domAnalysis

  try {
    ;({ desktopScreenshotBuffer, mobileScreenshotBuffer, domAnalysis } = await captureAndAnalyze(browser, targetUrl))
  } finally {
    await browser.close()
  }

  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL

  // デスクトップR2アップロード
  const desktopKey = `screenshots/${targetLpId}.webp`
  await r2.send(
    new PutObjectCommand({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      Key: desktopKey,
      Body: desktopScreenshotBuffer,
      ContentType: 'image/webp',
    })
  )
  const screenshotUrl = publicUrl
    ? `${publicUrl}/${desktopKey}`
    : `https://pub-${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.dev/${desktopKey}`
  console.log(`Desktop screenshot uploaded: ${screenshotUrl}`)

  // モバイルR2アップロード
  let mobileScreenshotUrl = null
  if (mobileScreenshotBuffer) {
    const mobileKey = `screenshots/${targetLpId}_mobile.webp`
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: mobileKey,
        Body: mobileScreenshotBuffer,
        ContentType: 'image/webp',
      })
    )
    mobileScreenshotUrl = publicUrl
      ? `${publicUrl}/${mobileKey}`
      : `https://pub-${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.dev/${mobileKey}`
    console.log(`Mobile screenshot uploaded: ${mobileScreenshotUrl}`)
  }

  // スクリーンショットURLをLPに保存
  const updateData = {
    screenshot_url: screenshotUrl,
    last_checked_at: new Date().toISOString(),
  }
  if (mobileScreenshotUrl) updateData.mobile_screenshot_url = mobileScreenshotUrl

  const { error: lpError } = await supabase
    .from('lps')
    .update(updateData)
    .eq('id', targetLpId)

  if (lpError) {
    console.error(`Failed to update lps for ${targetLpId}:`, lpError)
    return false
  }

  // DOM解析結果をlp_page_featuresにupsert
  if (domAnalysis) {
    try {
      const { error: featError } = await supabase
        .from('lp_page_features')
        .upsert(
          {
            lp_id: targetLpId,
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
        console.warn(`Failed to upsert lp_page_features for ${targetLpId}:`, featError.message)
      } else {
        console.log(`DOM analysis saved for ${targetLpId}`)
      }
    } catch (e) {
      console.warn(`lp_page_features upsert error for ${targetLpId}:`, e.message)
    }
  }

  console.log(`Successfully updated LP ${targetLpId}`)
  return true
}

async function runBatch() {
  const supabase = createSupabaseClient()
  const r2 = createR2Client()

  const { data: lps, error } = await supabase
    .from('lps')
    .select('id, url')
    .or('screenshot_url.is.null,mobile_screenshot_url.is.null')
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Failed to fetch LPs:', error)
    process.exit(1)
  }

  if (!lps || lps.length === 0) {
    console.log('No LPs without screenshots found.')
    return
  }

  console.log(`Found ${lps.length} LPs without screenshots.`)

  let success = 0
  let failure = 0

  for (const lp of lps) {
    try {
      const ok = await processLP(supabase, r2, lp.id, lp.url)
      if (ok) success++
      else failure++
    } catch (err) {
      console.error(`Error processing LP ${lp.id}:`, err.message)
      failure++
    }
    // 連続アクセスを避けるため少し待機
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  console.log(`Batch complete: ${success} succeeded, ${failure} failed`)
}

async function runSingle() {
  const supabase = createSupabaseClient()
  const r2 = createR2Client()
  const ok = await processLP(supabase, r2, lpId, url)
  if (!ok) process.exit(1)
}

if (isBatch) {
  runBatch().catch((err) => {
    console.error('Batch failed:', err)
    process.exit(1)
  })
} else {
  runSingle().catch((err) => {
    console.error('Screenshot failed:', err)
    process.exit(1)
  })
}
