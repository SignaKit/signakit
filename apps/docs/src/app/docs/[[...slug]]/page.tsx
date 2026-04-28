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
  if (!page) return {}

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: `https://docs.signakit.com/flags${slug ? `/${slug.join('/')}` : ''}`,
    },
    openGraph: {
      title: `${page.data.title} — SignaKit Docs`,
      description: page.data.description,
    },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params
  const page = source.getPage(slug)
  if (!page) notFound()

  const { body: Mdx, toc, lastModified } = await page.data.load()

  return (
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
