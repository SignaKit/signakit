import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'SignaKit Documentation',
  description:
    'Developer documentation for SignaKit feature flags, A/B testing, and experimentation. SDKs for Node.js, React, Python, Go, PHP, Laravel, Java, Flutter, and more.',
  alternates: { canonical: 'https://docs.signakit.com' },
}

const flagsQuickLinks = [
  { label: 'Node.js SDK', href: '/docs/flags/sdks/node' },
  { label: 'React SDK', href: '/docs/flags/sdks/react' },
  { label: 'Python SDK', href: '/docs/flags/sdks/python' },
  { label: 'Go SDK', href: '/docs/flags/sdks/go' },
  { label: 'Next.js Guide', href: '/docs/flags/guides/nextjs-app-router' },
]

export default function DocsLandingPage() {
  return (
    <div className="min-h-screen bg-fd-background text-fd-foreground">
      {/* Header */}
      <header className="border-b border-fd-border">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-semibold">
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
            <span className="text-fd-muted-foreground font-normal">docs</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-fd-muted-foreground">
            <a href="https://signakit.com" className="hover:text-fd-foreground transition-colors">
              signakit.com
            </a>
            <a
              href="https://app.signakit.com"
              className="hover:text-fd-foreground transition-colors"
            >
              Dashboard →
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-sm font-medium text-fd-primary mb-3 uppercase tracking-widest">
          Documentation
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-fd-foreground mb-4">
          Build with SignaKit
        </h1>
        <p className="text-lg text-fd-muted-foreground max-w-xl leading-relaxed mb-14">
          SDKs, concepts, and framework guides for feature flags, A/B testing, and experimentation.
        </p>

        {/* Product Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mb-16">
          {/* Flags card */}
          <Link
            href="/docs/flags/quickstart"
            className="group rounded-xl border border-fd-border bg-fd-card p-7 transition-all hover:border-fd-primary/40 hover:shadow-sm"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fd-primary/10 text-fd-primary">
                <FlagIcon />
              </div>
              <h2 className="text-base font-semibold text-fd-foreground">SignaKit Flags</h2>
            </div>
            <p className="text-sm text-fd-muted-foreground leading-relaxed mb-5">
              Feature flags, targeted rollouts, A/B tests, and multi-armed bandits. SDKs for 10
              platforms and 17 framework guides.
            </p>
            <div className="flex flex-wrap gap-2 mb-5">
              {['Node.js', 'React', 'Python', 'Go', 'PHP', 'Java', 'Flutter'].map((sdk) => (
                <span
                  key={sdk}
                  className="inline-flex items-center rounded-md bg-fd-muted px-2 py-0.5 text-xs font-medium text-fd-muted-foreground"
                >
                  {sdk}
                </span>
              ))}
            </div>
            <span className="text-sm font-medium text-fd-primary group-hover:underline">
              Get started →
            </span>
          </Link>

          {/* Events card — coming soon */}
          <div className="rounded-xl border border-fd-border bg-fd-card p-7 opacity-60">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fd-muted text-fd-muted-foreground">
                <ChartIcon />
              </div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-fd-foreground">SignaKit Events</h2>
                <span className="inline-flex items-center rounded-full bg-fd-muted px-2 py-0.5 text-xs font-medium text-fd-muted-foreground">
                  Coming soon
                </span>
              </div>
            </div>
            <p className="text-sm text-fd-muted-foreground leading-relaxed mb-5">
              Custom event tracking and analytics for web and mobile. Server-side and client-side
              SDKs with flexible properties.
            </p>
            <Link
              href="/docs/events"
              className="text-sm font-medium text-fd-muted-foreground hover:text-fd-foreground transition-colors"
            >
              Learn more →
            </Link>
          </div>
        </div>

        {/* Quick links */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-fd-muted-foreground mb-4">
            Popular pages
          </h3>
          <div className="flex flex-wrap gap-2">
            {flagsQuickLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-fd-border bg-fd-card px-3.5 py-2 text-sm text-fd-foreground transition-colors hover:border-fd-primary/40 hover:bg-fd-accent"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

function FlagIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  )
}
