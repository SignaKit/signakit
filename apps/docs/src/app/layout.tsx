import type { Metadata } from 'next'
import { Geist_Mono, DM_Sans } from 'next/font/google'
import { NextProvider } from 'fumadocs-core/framework/next'
import { TreeContextProvider } from 'fumadocs-ui/contexts/tree'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { source } from '@/lib/source'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
})

export const metadata: Metadata = {
  metadataBase: new URL('https://docs.signakit.com'),
  title: {
    default: 'SignaKit Documentation',
    template: '%s — SignaKit Docs',
  },
  description:
    'Developer documentation for SignaKit feature flags, A/B testing, and experimentation. SDKs for Node.js, React, Python, Go, PHP, Laravel, Java, Flutter, and more.',
  openGraph: {
    type: 'website',
    siteName: 'SignaKit Docs',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SignaKit Docs' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@signakit',
    images: ['/og-image.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${geistMono.variable}`}>
      <body className="flex flex-col min-h-screen antialiased">
        <NextProvider>
          <TreeContextProvider tree={source.getPageTree()}>
            <RootProvider>{children}</RootProvider>
          </TreeContextProvider>
        </NextProvider>
      </body>
    </html>
  )
}
