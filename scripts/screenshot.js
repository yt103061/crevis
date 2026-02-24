#!/usr/bin/env node
/**
 * LPスクリーンショット取得スクリプト
 * 使い方: node scripts/screenshot.js <lp_id> <url>
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
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000,
    })
    const bodyHeight = await page.evaluate(() =>
      Math.min(document.body.scrollHeight, 5000)
    )
    await page.setViewport({ width: 1280, height: bodyHeight })
    screenshotBuffer = await page.screenshot({
      type: 'webp',
      quality: 85,
      fullPage: false,
    })
  } finally {
    await browser.close()
  }

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

  const { error } = await supabase
    .from('lps')
    .update({ screenshot_url: screenshotUrl, last_checked_at: new Date().toISOString() })
    .eq('id', lpId)

  if (error) {
    console.error('Failed to update Supabase:', error)
    process.exit(1)
  }

  console.log(`Successfully updated LP ${lpId} with screenshot URL`)
}

takeScreenshot().catch((err) => {
  console.error('Screenshot failed:', err)
  process.exit(1)
})
