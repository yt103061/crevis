import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'CreVis - 成果の出るLPギャラリー',
    template: '%s | CreVis',
  },
  description:
    'AIが分析した成果の出るランディングページ（LP）ギャラリー。CVR・構造・コピー・信頼スコアで評価。日本のデザイナー・Webマーケター向け。',
  keywords: ['LP', 'ランディングページ', 'ギャラリー', 'CRO', 'CVR', 'デザイン', 'AI分析'],
  openGraph: {
    title: 'CreVis - 成果の出るLPギャラリー',
    description: 'AIが分析した成果の出るランディングページ（LP）ギャラリー',
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
