# SignaKit Docs

The public documentation site for SignaKit, published at [docs.signakit.com](https://docs.signakit.com).

Built with [Next.js](https://nextjs.org) and [Fumadocs](https://fumadocs.vercel.app).

---

## Running Locally

```bash
npm install
npm run dev
```

The site runs at [http://localhost:3000](http://localhost:3000).

---

## Content Structure

All documentation is written in MDX and lives under `content/docs/`.

```
content/docs/
  flags/
    index.mdx              # SignaKit Flags landing page
    quickstart.mdx         # Getting started guide
    concepts/              # Core concepts (feature flags, A/B testing, audiences, etc.)
    sdks/                  # Per-SDK reference pages (node, browser, react, php, etc.)
    guides/                # Framework integration guides (Next.js, Laravel, etc.)
    changelog.mdx          # SDK changelog
  events/
    index.mdx              # SignaKit Events landing page
```

### Adding a new page

1. Create a new `.mdx` file in the appropriate directory
2. Add frontmatter at the top:

```mdx
---
title: Page Title
description: A short description shown in search and meta tags.
---
```

3. Add the page to the relevant `meta.json` to control its position in the sidebar:

```json
{
  "pages": ["existing-page", "your-new-page"]
}
```

### Adding a new section

Create a subdirectory with its own `meta.json`:

```json
{
  "title": "Section Title",
  "pages": ["first-page", "second-page"]
}
```

---

## Contributing Docs

Good documentation contributions include:
- Fixing incorrect or outdated content
- Adding framework integration guides under `flags/guides/`
- Filling in SDK reference pages under `flags/sdks/`
- Clarifying concepts or adding examples

When writing, keep examples accurate to the actual SDK APIs — refer to the package `README.md` files in `packages/` as the source of truth for API signatures.

### Style guidelines

- Use second person ("you", not "the user" or "the developer")
- Code examples should be complete and runnable, not fragments where avoidable
- Include the anti-patterns and gotchas — not just the happy path
- Keep pages focused; link to related concepts rather than repeating them

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| [Next.js 16](https://nextjs.org) | Framework |
| [Fumadocs](https://fumadocs.vercel.app) | Docs UI and MDX pipeline |
| [Tailwind CSS v4](https://tailwindcss.com) | Styling |
| [Fumadocs Twoslash](https://fumadocs.vercel.app/docs/ui/twoslash) | TypeScript-aware code blocks |
