import type { ComponentProps, FC } from 'react'
import { notFound } from 'next/navigation'
import { DocsPage, PageLastUpdate } from 'fumadocs-ui/layouts/docs/page'
import * as Twoslash from 'fumadocs-twoslash/ui'
import { Callout } from 'fumadocs-ui/components/callout'
import { TypeTable } from 'fumadocs-ui/components/type-table'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { Card, Cards } from 'fumadocs-ui/components/card'
import { findSiblings } from 'fumadocs-core/page-tree'
import { source } from '@/lib/source'
import { getMDXComponents } from '@/components/mdx'
import type { Metadata } from 'next'

export const revalidate = false

export async function generateStaticParams() {
  return source.generateParams()
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>
}): Promise<Metadata> {
  const { slug = [] } = await params
  const page = source.getPage(slug)
  if (!page) return { title: 'Page Not Found' }

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: `https://docs.signakit.com/docs/${slug.join('/')}`,
    },
    openGraph: {
      title: `${page.data.title} — SignaKit Docs`,
      description: page.data.description,
    },
    ...(slug?.[0] === 'events' && { robots: { index: false, follow: true } }),
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const { body: Mdx, toc, lastModified } = await page.data.load()

  const slugArr = slug ?? []
  const pageUrl = `https://docs.signakit.com/docs/${slugArr.join('/')}`

  const breadcrumbItems = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'SignaKit Docs',
      item: 'https://docs.signakit.com',
    },
    ...slugArr.map((segment, index) => {
      const isLast = index === slugArr.length - 1
      const name = isLast
        ? page.data.title
        : segment.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      const item = `https://docs.signakit.com/docs/${slugArr.slice(0, index + 1).join('/')}`
      return {
        '@type': 'ListItem',
        position: index + 2,
        name,
        item,
      }
    }),
  ]

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'TechArticle',
        headline: page.data.title,
        description: page.data.description ?? '',
        url: pageUrl,
        ...(lastModified ? { dateModified: lastModified.toISOString() } : {}),
        author: { '@type': 'Organization', name: 'SignaKit', url: 'https://signakit.com' },
        publisher: { '@type': 'Organization', name: 'SignaKit', url: 'https://signakit.com' },
        isPartOf: {
          '@type': 'WebSite',
          name: 'SignaKit Documentation',
          url: 'https://docs.signakit.com',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems,
      },
    ],
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <DocsPage
        toc={toc}
        tableOfContent={{
          style: 'clerk',
        }}
      >
        <h1 className="text-[1.75em] font-semibold">{page.data.title}</h1>
        <p className="text-lg text-fd-muted-foreground mb-2">{page.data.description}</p>
        <div className="prose flex-1 text-fd-foreground/90">
          <Mdx
            components={getMDXComponents({
              ...Twoslash,
              a: createRelativeLink(source, page),
              TypeTable,
              blockquote: Callout as unknown as FC<ComponentProps<'blockquote'>>,
              DocsCategory: ({ url }) => {
                return <DocsCategory url={url ?? page.url} />
              },
            })}
          />
        </div>
        {lastModified && <PageLastUpdate date={lastModified} />}
      </DocsPage>
    </>
  )
}

function DocsCategory({ url }: { url: string }) {
  return (
    <Cards>
      {findSiblings(source.getPageTree(), url).map((item) => {
        if (item.type === 'separator') return
        if (item.type === 'folder') {
          if (!item.index) return
          item = item.index
        }

        return (
          <Card key={item.url} title={item.name} href={item.url}>
            {item.description}
          </Card>
        )
      })}
    </Cards>
  )
}
