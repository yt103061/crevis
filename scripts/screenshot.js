#!/usr/bin/env node
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
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  let screenshotBuffer
  let pageFeatures = null

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    const start = Date.now()
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })
    const loadMs = Date.now() - start

    const bodyHeight = await page.evaluate(() => Math.min(document.body.scrollHeight, 5000))
    await page.setViewport({ width: 1280, height: bodyHeight })
    screenshotBuffer = await page.screenshot({ type: 'webp', quality: 85, fullPage: false })

    pageFeatures = await page.evaluate((loadTimeMs) => {
      const textOf = (el) => (el?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 200)
      const navLinkCount = document.querySelectorAll('nav a').length
      const links = Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href') || '')
      const externalLinkCount = links.filter((href) => href.startsWith('http') && !href.includes(location.hostname)).length
      const internalLinkCount = links.length - externalLinkCount
      const ctaButtons = Array.from(document.querySelectorAll('button, a')).map((el) => textOf(el)).filter((t) => /(無料|申込|登録|購入|資料|trial|start|contact|join|signup)/i.test(t)).slice(0, 20)
      const formFieldCount = document.querySelectorAll('form input, form select, form textarea').length
      const totalSections = document.querySelectorAll('section, article, main, div').length
      return {
        h1_text: textOf(document.querySelector('h1')),
        h2_texts: Array.from(document.querySelectorAll('h2')).map(textOf).filter(Boolean).slice(0, 20),
        meta_title: document.title,
        meta_description: document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
        main_copy_snippets: Array.from(document.querySelectorAll('section, article, main')).map(textOf).filter(Boolean).slice(0, 10),
        cta_buttons: ctaButtons,
        total_sections: totalSections,
        page_height_ratio: Math.max(1, totalSections / 6),
        nav_link_count: navLinkCount,
        external_link_count: externalLinkCount,
        internal_link_count: internalLinkCount,
        form_field_count: formFieldCount,
        has_main_form: document.querySelectorAll('form').length > 0 && formFieldCount >= 2,
        has_social_proof: /trusted by|導入実績|利用社数/i.test(document.body.innerText),
        has_testimonials: /testimonial|お客様の声|口コミ/i.test(document.body.innerText),
        has_faq: /faq|よくある質問/i.test(document.body.innerText),
        has_pricing: /pricing|料金|price|プラン/i.test(document.body.innerText),
        has_no_index: /noindex/i.test(document.querySelector('meta[name="robots"]')?.getAttribute('content') || ''),
        has_video: !!document.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"]'),
        total_image_count: document.querySelectorAll('img').length,
        page_load_time_ms: loadTimeMs,
      }
    }, loadMs)
  } finally {
    await browser.close()
  }

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY },
  })

  const key = `screenshots/${lpId}.webp`
  await r2.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: screenshotBuffer, ContentType: 'image/webp' }))

  const screenshotUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL}/${key}`
    : `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev/${key}`

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  await supabase.from('lps').update({ screenshot_url: screenshotUrl, last_checked_at: new Date().toISOString() }).eq('id', lpId)

  if (pageFeatures) {
    await supabase.from('lp_page_features').upsert({ lp_id: lpId, ...pageFeatures, analyzed_at: new Date().toISOString() })
  }

  console.log(`Successfully updated LP ${lpId} with screenshot URL and page features`)
}

takeScreenshot().catch((err) => {
  console.error('Screenshot failed:', err)
  process.exit(1)
})
