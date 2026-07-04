# Contributing to Structura

Thank you for your interest in contributing! This document explains how to get involved, what we expect, and how to get your changes merged efficiently.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Architecture Overview](#architecture-overview)
- [Development Workflow](#development-workflow)
- [Naming and File Conventions](#naming-and-file-conventions)
- [Commit Convention](#commit-convention)
- [Pull Request Process](#pull-request-process)
- [Issue Labels](#issue-labels)

---

## Code of Conduct

This project follows our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

---

## Ways to Contribute

| Type                | How                                                                  |
| ------------------- | -------------------------------------------------------------------- |
| 🐛 Bug reports      | Open a [bug report](.github/ISSUE_TEMPLATE/bug_report.yml)           |
| 💡 Feature requests | Open a [feature request](.github/ISSUE_TEMPLATE/feature_request.yml) |
| 🔧 Bug fixes        | Fork → fix → PR                                                      |
| ✨ New features     | **Discuss in an issue first** before opening a PR                    |
| 📖 Documentation    | Same workflow as code changes                                        |
| 🧪 Tests            | Always welcome                                                       |

> **New here?** Look for issues labeled [`good first issue`](https://github.com/clarkjoao/Structura/issues?q=label%3A%22good+first+issue%22) or [`help wanted`](https://github.com/clarkjoao/Structura/issues?q=label%3A%22help+wanted%22).

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Local Setup

```bash
git clone https://github.com/clarkjoao/Structura.git
cd Structura
npm install
npm run dev        # http://localhost:8080
```

### Available Scripts

```bash
npm run dev          # Dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (unit)
npm run test:watch   # Vitest watch mode
npm run cy:open      # Cypress interactive
npm run cy:run       # Cypress headless
```

---

## Architecture Overview

Understanding the architecture is **mandatory** before contributing. Violating these boundaries will cause your PR to be rejected.

```
src/
├── features/
│   ├── diagram/      ← PURE DOMAIN — no React, no side effects
│   └── canvas/       ← UI layer — React, ReactFlow, hooks
├── infrastructure/
│   └── persistence/  ← Storage adapters only
├── components/ui/    ← Stateless shadcn/ui primitives
└── hooks/            ← Shared app hooks
```

### Critical Constraints

#### Imports

```ts
// ✅ CORRECT
import { ... } from '@/features/diagram'

// ❌ FORBIDDEN
import { ... } from 'src/lib/model-types'
import { ... } from 'src/lib/model-store'
```

#### State mutations — Undo/Redo is non-negotiable

```ts
// ✅ CORRECT — pushHistory MUST be called first, before any mutation
set((state) => {
  pushHistory(state);
  state.components[id].label = newLabel;
});

// ❌ WRONG — missing pushHistory
// ❌ WRONG — pushHistory called after mutation
```

#### Node drag — never call setParent or updateNodeLayout directly

```ts
// ✅ CORRECT
commitNodeDrag(nodeId, position);

// ❌ FORBIDDEN
setParent(nodeId, parentId);
updateNodeLayout(nodeId, position);
```

#### Node rendering order (strict, never reorder)

```
panel → swimlane → note → apiGroup → endpoint → c4
```

#### Type guards — never use string checks

```ts
// ✅ CORRECT
if (isC4Component(node)) { ... }

// ❌ FORBIDDEN
if (node.type === 'c4') { ... }
```

#### UI Text — no hardcoded strings

```ts
// ✅ CORRECT
const { t } = useTranslation()
<Button>{t('actions.save')}</Button>

// ❌ FORBIDDEN
<Button>Save</Button>
```

---

## Development Workflow

1. **Find or open an issue** — every PR must be linked to an issue
2. **Fork the repository**
3. **Create a branch** from `main`:
   ```bash
   git checkout -b feat/my-feature
   git checkout -b fix/my-bug
   ```
4. **Implement** following all constraints above
5. **Run checks before pushing**:
   ```bash
   npm run lint && npm run test && npm run build
   ```
6. **Open a PR** against `main`

---

## Naming and File Conventions

These apply to **new files**. Existing files use older mixed styles; do not
mass-rename them (it destroys `git blame` and conflicts with open PRs) —
renaming is fine when you are already substantially rewriting a file.

| What                                         | Convention                                                                                                                 | Example               |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| React components                             | `PascalCase.tsx`, one component per file                                                                                   | `FlowPanel.tsx`       |
| Everything else (utils, hooks files, stores) | `kebab-case.ts`                                                                                                            | `flow-repair.ts`      |
| Hooks                                        | `useXxx` export, file may be `useXxx.ts`                                                                                   | `useAutoLayout.ts`    |
| Tests                                        | colocated next to the code as `<name>.test.ts(x)` — no `__tests__/` folders                                                | `flow-repair.test.ts` |
| Constants                                    | one `<feature>.constants.ts` per feature root; node-local constants stay next to the node                                  | `canvas.constants.ts` |
| Types                                        | `types.ts` (or `<area>.types.ts`) inside the feature; shared domain types live in `@/features/diagram`                     | `edgeData.types.ts`   |
| Imports                                      | always via the `@/` alias for cross-directory imports; relative only within the same folder subtree                        | `@/features/diagram`  |
| Feature placement                            | user-facing capability → `src/features/<name>/`; route shell → `src/pages/`; storage/i18n plumbing → `src/infrastructure/` | —                     |

---

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

Types: feat | fix | docs | style | refactor | test | chore | perf
Scope: diagram | canvas | persistence | flows | layout | ci | deps
```

Examples:

```
feat(canvas): add alignment toolbar
fix(diagram): call pushHistory before label mutation
perf(canvas): replace full store selector with fine-grained selectors
test(layout): add unit tests for computeGridLayout
```

---

## Pull Request Process

- PRs without a linked issue will be closed
- All CI checks must pass (lint, type-check, unit tests)
- At least one maintainer approval required
- Keep PRs focused — one concern per PR

### PR checklist (reviewers will verify)

- [ ] Linked to an issue
- [ ] `pushHistory` called correctly (if mutating state)
- [ ] No `updateNodeLayout` / `setParent` called directly
- [ ] No hardcoded UI strings
- [ ] Type guards used (no `node.type === '...'`)
- [ ] Imports only from `@/features/diagram`
- [ ] `npm run lint` passes
- [ ] `npm run test` passes
- [ ] `npm run build` succeeds

---

## Issue Labels

| Label              | Meaning                    |
| ------------------ | -------------------------- |
| `bug`              | Something is broken        |
| `enhancement`      | New feature or improvement |
| `good first issue` | Suitable for newcomers     |
| `help wanted`      | Extra attention needed     |
| `persistence`      | Storage layer (high risk)  |
| `canvas`           | ReactFlow / canvas layer   |
| `diagram`          | Domain model / store       |
| `performance`      | Performance-related        |
| `documentation`    | Docs only                  |
