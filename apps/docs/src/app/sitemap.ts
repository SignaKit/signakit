import type { MetadataRoute } from 'next'

const BASE_URL = 'https://docs.signakit.com'

const flagsSdks = [
  'node', 'browser', 'react', 'react-native',
  'flutter', 'python', 'go', 'java', 'php', 'laravel',
]

const flagsConcepts = [
  'feature-flags', 'targeted-delivery', 'ab-testing',
  'multi-armed-bandit', 'audiences', 'events-and-metrics',
  'environments', 'sdk-architecture',
]

const flagsGuides = [
  'nextjs-app-router', 'nextjs-pages-router', 'nextjs-middleware',
  'remix', 'express', 'fastify', 'nestjs', 'react-spa',
  'react-native-expo', 'flutter-mobile', 'laravel-guide', 'symfony', 'wordpress',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/flags/quickstart`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/flags/changelog`, lastModified: now, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/events`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ]

  const sdkPages: MetadataRoute.Sitemap = flagsSdks.map((sdk) => ({
    url: `${BASE_URL}/flags/sdks/${sdk}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.9,
  }))

  const conceptPages: MetadataRoute.Sitemap = flagsConcepts.map((concept) => ({
    url: `${BASE_URL}/flags/concepts/${concept}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))

  const guidePages: MetadataRoute.Sitemap = flagsGuides.map((guide) => ({
    url: `${BASE_URL}/flags/guides/${guide}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.85,
  }))

  return [...staticPages, ...sdkPages, ...conceptPages, ...guidePages]
}
