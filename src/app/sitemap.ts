import { MetadataRoute } from 'next'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://crevis.jp'

  let lpUrls: MetadataRoute.Sitemap = []

  // Supabase設定がある場合のみDBからLP一覧を取得
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const { createServiceClient } = await import('@/lib/supabase')
      const supabase = createServiceClient()
      const { data: lps } = await supabase
        .from('lps')
        .select('id, created_at')
        .eq('status', 'active')
        .limit(1000)

      lpUrls = (lps ?? []).map((lp) => ({
        url: `${appUrl}/lp/${lp.id}`,
        lastModified: new Date(lp.created_at),
        changeFrequency: 'monthly' as const,
        priority: 0.7,
      }))
    } catch {
      // サイトマップ生成は失敗しても続行
    }
  }

  return [
    {
      url: appUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${appUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${appUrl}/newsletter`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    ...lpUrls,
  ]
}
