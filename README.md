# SignaKit

Open-source SDKs and documentation for [SignaKit](https://signakit.com) — a developer platform for feature flags, A/B testing, and custom event tracking.

This repository contains:

- **`packages/`** — all official SignaKit SDKs, published to npm and other registries
- **`apps/docs`** — the public documentation site ([docs.signakit.com](https://docs.signakit.com)), built with Next.js and Fumadocs

The SignaKit dashboard (`app.signakit.com`) and backend infrastructure are maintained in a separate private repository.

---

## Packages

| Package | Registry | Language | Description |
|---|---|---|---|
| [`@signakit/flags-node`](./packages/flags-node) | npm | TypeScript | Server-side feature flags for Node.js |
| [`@signakit/flags-browser`](./packages/flags-browser) | npm | TypeScript | Client-side feature flags for the browser |
| [`@signakit/flags-react`](./packages/flags-react) | npm | TypeScript | React hooks and components wrapper |
| [`@signakit/flags-react-native`](./packages/flags-react-native) | npm | TypeScript | React Native SDK |
| [`signakit/flags-php`](./packages/flags-php) | Composer | PHP | Server-side feature flags for PHP |
| [`signakit/flags-laravel`](./packages/flags-laravel) | Composer | PHP | Laravel-specific wrapper |
| [`signakit-flutter`](./packages/flags-flutter) | pub.dev | Dart | Feature flags for Flutter |
| [`signakit`](./packages/flags-python) | PyPI | Python | Server-side feature flags for Python |
| [`signakit`](./packages/flags-golang) | Go modules | Go | Server-side feature flags for Go |
| [`com.signakit/flags-java`](./packages/flags-java) | Maven | Java | Server-side feature flags for Java/JVM |

---

## Getting Started

### Prerequisites

- Node.js >= 20
- npm >= 10

### Install dependencies

```bash
npm install
```

### Run the docs site locally

```bash
cd apps/docs
npm run dev
```

The docs site runs at [http://localhost:3000](http://localhost:3000).

### Build an SDK

```bash
cd packages/flags-node
npm run build
```

---

## Contributing

Contributions are welcome — bug fixes, new framework guides, SDK improvements, and documentation improvements are all fair game.

### What lives here

- **SDK bugs and improvements** — open an issue or PR against the relevant `packages/` directory
- **Documentation** — content lives in `apps/docs/content/`; see the [docs app README](./apps/docs/README.md) for details
- **New SDK features** — open an issue first to discuss before building

### What lives elsewhere

The SignaKit dashboard, backend API, and infrastructure are in a private repository. Issues with `app.signakit.com` behavior should be reported to [support@signakit.com](mailto:support@signakit.com).

---

## Git Standards

### Branch Naming

Branches must follow this pattern: `<type>/<short-description>`

| Type | When to use |
|---|---|
| `feat/` | New feature or SDK capability |
| `fix/` | Bug fix |
| `docs/` | Documentation-only changes |
| `chore/` | Maintenance, dependency updates, config |
| `refactor/` | Refactoring with no behavior change |
| `test/` | Adding or updating tests |

Examples:
```
feat/flags-react-suspense-support
fix/flags-node-config-retry-loop
docs/nextjs-app-router-guide
chore/bump-typescript-5.5
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/). Format: `<type>(<scope>): <description>`

The `scope` should be the package or area being changed: `flags-node`, `flags-react`, `docs`, `flags-php`, etc.

```
feat(flags-react): add useFlagVariation hook
fix(flags-node): handle empty config response gracefully
docs(flags-browser): add sessionStorage dedup explanation
chore(flags-react): bump peer dependency range for React 19
```

Rules:
- Use the imperative mood ("add", not "added" or "adds")
- Keep the subject line under 72 characters
- Reference issues at the end of the body: `Closes #42`
- Breaking changes must include `!` after the type/scope: `feat(flags-node)!: rename createInstance to createClient`

### Opening a Pull Request

1. **Branch off `main`** — all PRs target `main` directly
2. **Keep PRs focused** — one logical change per PR; split unrelated changes
3. **Fill out the PR description** — explain what changed and why, not just what
4. **Link any related issues** — use `Closes #N` in the description to auto-close on merge
5. **Ensure CI passes** — typecheck, lint, and tests must be green before review
6. **One approving review required** — from a maintainer before merge

PR title should follow the same Conventional Commits format as commit messages.

---

## License

MIT — see [LICENSE](./LICENSE) for details.

Each SDK package also includes its own `LICENSE` file.
