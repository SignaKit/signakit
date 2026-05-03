import type { Metadata } from 'next'
import { Geist_Mono, DM_Sans } from 'next/font/google'
import { NextProvider } from 'fumadocs-core/framework/next'
import { TreeContextProvider } from 'fumadocs-ui/contexts/tree'
import { RootProvider } from 'fumadocs-ui/provider/base'
import { source } from '@/lib/source'
import { GoogleTagManager } from '@next/third-parties/google'
import './globals.css'

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

const dmSans = DM_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  display: 'swap',
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
    description:
      'Developer documentation for SignaKit feature flags, A/B testing, and experimentation. SDKs for Node.js, React, Python, Go, PHP, Laravel, Java, Flutter, and more.',
    url: 'https://docs.signakit.com',
  },
  twitter: {
    card: 'summary_large_image',
    site: '@signakit',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'SignaKit Documentation' }],
  },
  icons: {
    icon: [
      '/favicon.ico',
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'SignaKit Documentation',
      url: 'https://docs.signakit.com',
      potentialAction: {
        '@type': 'SearchAction',
        target: 'https://docs.signakit.com/docs?q={search_term_string}',
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'SignaKit',
      url: 'https://signakit.com',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web, Node.js, Browser, Python, Go, PHP, Java, Flutter, React Native',
      description:
        'Feature flags, targeted rollouts, A/B tests, and multi-armed bandits with local evaluation and SDKs for 10 platforms.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      sameAs: ['https://app.signakit.com'],
    },
    {
      '@type': 'Organization',
      name: 'SignaKit',
      url: 'https://signakit.com',
      logo: 'https://docs.signakit.com/og-image.png',
      sameAs: ['https://app.signakit.com'],
    },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${geistMono.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
          }}
        />
      </head>
      <body className="flex flex-col min-h-screen antialiased">
        <NextProvider>
          <TreeContextProvider tree={source.getPageTree()}>
            <RootProvider>{children}</RootProvider>
          </TreeContextProvider>
        </NextProvider>

        {process.env.NEXT_PUBLIC_GTM_ID && (
          <GoogleTagManager gtmId={process.env.NEXT_PUBLIC_GTM_ID} />
        )}
      </body>
    </html>
  )
}
