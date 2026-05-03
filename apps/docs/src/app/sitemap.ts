import type { MetadataRoute } from 'next'

const BASE_URL = 'https://docs.signakit.com'
const DOCS = `${BASE_URL}/docs`

const flagsSdks = [
  'node', 'browser', 'react', 'react-native',
  'flutter', 'python', 'go', 'java', 'php', 'laravel',
]

const flagsConcepts = [
  'feature-flags', 'targeted-delivery', 'ab-testing',
  'multi-armed-bandit', 'audiences', 'events-and-metrics',
  'environments', 'user-ids', 'sdk-architecture',
]

const flagsGuides = [
  'nextjs-app-router', 'nextjs-pages-router', 'nextjs-middleware',
  'remix', 'express', 'fastify', 'nestjs', 'react-spa',
  'react-native-expo', 'flutter-mobile', 'laravel-guide', 'symfony', 'wordpress',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now },
    { url: `${DOCS}/flags`, lastModified: now },
    { url: `${DOCS}/flags/quickstart`, lastModified: now },
    { url: `${DOCS}/flags/changelog`, lastModified: now },
  ]

  const sdkPages: MetadataRoute.Sitemap = flagsSdks.map((sdk) => ({
    url: `${DOCS}/flags/sdks/${sdk}`,
    lastModified: now,
  }))

  const conceptPages: MetadataRoute.Sitemap = flagsConcepts.map((concept) => ({
    url: `${DOCS}/flags/concepts/${concept}`,
    lastModified: now,
  }))

  const guidePages: MetadataRoute.Sitemap = flagsGuides.map((guide) => ({
    url: `${DOCS}/flags/guides/${guide}`,
    lastModified: now,
  }))

  return [...staticPages, ...sdkPages, ...conceptPages, ...guidePages]
}
