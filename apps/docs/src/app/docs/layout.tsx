import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'
import { linkItems } from '@/components/shared'
import { getSection } from '@/lib/navigation'
import type { ReactNode } from 'react'

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.getPageTree()}
      links={linkItems.filter((item) => item.type === 'icon')}
      nav={{
        title: (
          <span className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 no-underline">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4F6EF7"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41l-7.59-7.59a2.41 2.41 0 0 0-3.41 0Z"></path>
              </svg>
              <span className="font-sans text-base font-semibold text-foreground tracking-[-0.01em]">
                SignaKit
              </span>
            </span>
            <span className="text-fd-muted-foreground font-normal text-sm">docs</span>
          </span>
        ),
      }}
      tabs={{
        transform(option, node) {
          const meta = source.getNodeMeta(node)
          if (!meta || !node.icon) return option
          const color = `var(--${getSection(meta.path)}-color, var(--color-fd-foreground))`

          return {
            ...option,
            icon: (
              <div
                className="[&_svg]:size-full rounded-lg size-full text-(--tab-color) max-md:bg-(--tab-color)/10 max-md:border max-md:p-1.5"
                style={
                  {
                    '--tab-color': color,
                  } as object
                }
              >
                {node.icon}
              </div>
            ),
          }
        },
      }}
      sidebar={{
        footer: (
          <div className="px-2 py-2 text-xs text-fd-muted-foreground space-y-1">
            <a
              href="https://signakit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:text-fd-foreground transition-colors"
            >
              signakit.com ↗
            </a>
            <a
              href="https://app.signakit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block hover:text-fd-foreground transition-colors"
            >
              Dashboard ↗
            </a>
          </div>
        ),
      }}
    >
      {children}
    </DocsLayout>
  )
}
