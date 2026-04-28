# SignaKit - Project Context

## Architecture Overview

This is the public open-source repository for SignaKit. It contains two things:

- **`packages/`** — all official SignaKit SDKs (feature flags + events), published to npm, Composer, pub.dev, PyPI, Maven, and Go modules
- **`apps/docs`** — the public documentation site (`docs.signakit.com`), built with Next.js 16 and Fumadocs

The SignaKit dashboard (`app.signakit.com`), backend API, AWS Lambda infrastructure, and database schema live in a separate private repository.

### Packages

| Directory | Published as | Language |
|---|---|---|
| `packages/flags-node` | `@signakit/flags-node` | TypeScript |
| `packages/flags-browser` | `@signakit/flags-browser` | TypeScript |
| `packages/flags-react` | `@signakit/flags-react` | TypeScript |
| `packages/flags-react-native` | `@signakit/flags-react-native` | TypeScript |
| `packages/flags-php` | `signakit/flags-php` | PHP |
| `packages/flags-laravel` | `signakit/flags-laravel` | PHP |
| `packages/flags-flutter` | `signakit_flutter` | Dart |
| `packages/flags-python` | `signakit` | Python |
| `packages/flags-golang` | `github.com/signakit/flags-golang` | Go |
| `packages/flags-java` | `com.signakit:flags-java` | Java |

All SDKs share a unified version number. Each fetches flag config from CloudFront/S3 and evaluates flags locally — no network call on the hot `decide()` path.

### Docs App

`apps/docs` is a Next.js + Fumadocs site. Documentation content is MDX files under `apps/docs/content/docs/`, organized into `flags/` and `events/` sections with `concepts/`, `sdks/`, and `guides/` subdirectories.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **signakit** (2920 symbols, 5333 relationships, 159 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/signakit/context` | Codebase overview, check index freshness |
| `gitnexus://repo/signakit/clusters` | All functional areas |
| `gitnexus://repo/signakit/processes` | All execution flows |
| `gitnexus://repo/signakit/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
