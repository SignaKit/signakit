# Contributing to SignaKit

Thanks for your interest in contributing! This guide covers everything you need to work on the SignaKit SDKs and documentation site.

## Table of Contents

- [Repository layout](#repository-layout)
- [Before you start](#before-you-start)
- [Working on an SDK](#working-on-an-sdk)
  - [Setup](#setup)
  - [Running tests](#running-tests)
  - [Watching tests during development](#watching-tests-during-development)
  - [Type checking and linting](#type-checking-and-linting)
  - [Building](#building)
- [Test conventions](#test-conventions)
  - [File layout](#file-layout)
  - [What to test](#what-to-test)
  - [Updating tests when the SDK changes](#updating-tests-when-the-sdk-changes)
  - [Using the shared fixtures](#using-the-shared-fixtures)
- [Working on the docs site](#working-on-the-docs-site)
- [Submitting a pull request](#submitting-a-pull-request)
- [Adding a new SDK package](#adding-a-new-sdk-package)
- [License](#license)

---

## Repository layout

```
signakit/
├── packages/
│   ├── flags-node/          # @signakit/flags-node (TypeScript/Node.js)
│   ├── flags-browser/       # @signakit/flags-browser (TypeScript/Browser)
│   ├── flags-react/         # @signakit/flags-react (React)
│   ├── flags-react-native/  # @signakit/flags-react-native (React Native)
│   ├── flags-php/           # signakit/flags-php (PHP)
│   ├── flags-laravel/       # signakit/flags-laravel (Laravel)
│   ├── flags-flutter/       # signakit_flutter (Dart/Flutter)
│   ├── flags-python/        # signakit (Python)
│   ├── flags-golang/        # github.com/signakit/flags-golang (Go)
│   └── flags-java/          # com.signakit:flags-java (Java)
└── apps/
    └── docs/                # docs.signakit.com (Next.js + Fumadocs)
```

Each SDK package is self-contained with its own dependencies, build tooling, and test suite. You only need to install dependencies for the package you are working on.

---

## Before you start

- **Node.js 20+** is required for the TypeScript SDK packages and the docs app.
- Fork the repository and create your branch from `main`.
- Keep your changes focused — one bug fix or feature per PR makes review much faster.
- Search [existing issues](https://github.com/SignaKit/signakit/issues) before opening a new one.

---

## Working on an SDK

### Setup

Each package manages its own dependencies. Navigate to the package you want to work on and install:

```bash
cd packages/flags-node
npm install
```

No root-level install step is needed — the packages are not linked via a workspace manager.

### Running tests

```bash
npm test
```

This runs the full test suite (unit tests + integration tests) once and exits. The CI pipeline runs this exact command on every pull request that touches the package.

### Watching tests during development

```bash
npm run test:watch
```

Re-runs only the affected tests on every file save. Use this while actively making changes.

### Type checking and linting

```bash
npm run typecheck   # TypeScript — checks library source only, not test files
npm run lint        # ESLint
```

Both are run in CI. Fix any errors before opening a PR.

### Building

```bash
npm run build
```

Compiles TypeScript to `dist/` in both CJS and ESM formats with declaration files. The build is also verified in CI to catch any type errors introduced by changes to the public API shape.

---

## Test conventions

### File layout

Tests live alongside source in `src/__tests__/`:

```
src/
├── client.ts
├── evaluator.ts
├── audience-matcher.ts
├── hasher.ts
├── config-manager.ts
└── __tests__/
    ├── fixtures/
    │   └── config.ts          # Shared mock ProjectConfig used across all tests
    ├── client.test.ts
    ├── evaluator.test.ts
    ├── audience-matcher.test.ts
    ├── hasher.test.ts
    ├── config-manager.test.ts
    └── integration.test.ts    # Full SDK lifecycle as a real app would use it
```

Each test file corresponds to the source file it tests. `integration.test.ts` is the exception — it imports only from the public API (`src/index.ts`) and simulates realistic per-request usage patterns.

### What to test

**Unit tests** test one module in isolation with all external dependencies mocked:
- Happy paths — the normal, successful flow
- Error paths — invalid input, missing config, network failures
- Edge cases — empty strings, boundary values, missing optional fields

**Integration tests** (`integration.test.ts`) test the SDK end-to-end from a consumer's perspective:
- Only import from `../index` (the public API) — never from internal modules
- Mock `fetch` at the global level to simulate the CloudFront CDN and events API
- Simulate how a real application uses the SDK (one client at startup, one user context per request)

**Never** call real external APIs or use production data in tests.

### Updating tests when the SDK changes

| Type of change | What to update |
|---|---|
| New exported function or class | Add a new `describe` block in the corresponding unit test file |
| New audience condition operator | Add cases in `audience-matcher.test.ts` — one for the match case, one for the non-match case, one for type mismatch |
| New flag evaluation path | Add a test in `evaluator.test.ts` that exercises that specific path |
| Change to `trackEvent` / event payload | Update assertions in `client.test.ts` and `integration.test.ts` |
| New public config type field | Add fixture data in `src/__tests__/fixtures/config.ts` |
| Breaking change to the public API | Update `integration.test.ts` first — it reflects how real consumers use the SDK |

If a test needs to be deleted because the behaviour it covered was intentionally removed, add a comment in the PR description explaining what was removed and why.

### Using the shared fixtures

`src/__tests__/fixtures/config.ts` exports a `mockConfig` object — a realistic `ProjectConfig` that covers all evaluation scenarios:

| Flag key | Purpose |
|---|---|
| `new-checkout-flow` | A/B test with a premium audience rule + default allocation |
| `dark-mode` | Targeted 100% rollout (no experiment, no exposure events) |
| `allowlist-feature` | Allowlist-only access, 0% random traffic |
| `feature-with-vars` | Tests variable resolution (defaults + variation overrides) |
| `disabled-flag` | `running: false` — always returns `off` |
| `archived-flag` | `status: 'archived'` — excluded from all results |

When a new evaluation scenario requires a new flag shape, add it to `fixtures/config.ts` rather than defining one-off config objects inline in test files — unless the flag is only needed for a single focused test.

---

## Working on the docs site

```bash
cd apps/docs
npm install
npm run dev      # starts the local dev server at http://localhost:3000
```

Documentation content lives in `apps/docs/content/docs/` as MDX files organized under `flags/` and `events/`.

---

## Submitting a pull request

1. **Run the full check locally** before pushing:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```
2. Make sure all tests pass. Do not open a PR with failing tests.
3. If your change affects the public API or observable behaviour, update the relevant test file(s).
4. Keep the PR description focused on *why* the change was made, not just what files changed — the diff already shows that.
5. The GitHub Actions workflow will run automatically on your PR. A green check is required before merging.

---

## Adding a new SDK package

When a new language SDK is added to `packages/`:

1. Follow the same directory structure as `flags-node`: `src/`, `src/__tests__/`, `src/__tests__/fixtures/`.
2. Add a corresponding GitHub Actions workflow at `.github/workflows/test-flags-{language}.yml` triggered on `paths: ['packages/flags-{language}/**']`.
3. The workflow must run at minimum: type check (or equivalent), tests, and build.
4. All new packages should have tests for the same core scenarios: flag evaluation paths (archived, disabled, allowlist, audience, traffic, default), deterministic bucketing, bot exclusion, and event tracking.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
