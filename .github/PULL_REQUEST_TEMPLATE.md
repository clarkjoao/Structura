## Summary

<!-- What does this PR do? Link the related issue. -->

Closes #

---

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / performance
- [ ] Documentation
- [ ] Tests
- [ ] CI / tooling

---

## Architecture checklist

> These are non-negotiable. PRs that fail these will be closed without review.

- [ ] `pushHistory(state)` is the **first call** inside every `set()` that mutates diagram state
- [ ] No direct calls to `setParent()` or `updateNodeLayout()` — used `commitNodeDrag()` instead
- [ ] No imports from `src/lib/model-types` or `src/lib/model-store` — used `@/features/diagram` only
- [ ] Type guards used (e.g. `isC4Component(node)`) — no `node.type === '...'` string checks
- [ ] All UI text uses `i18n` / `useTranslation()` — no hardcoded strings
- [ ] Node rendering order preserved: `panel → swimlane → note → apiGroup → endpoint → c4`
- [ ] `features/diagram` contains no React imports

---

## Quality checklist

- [ ] `npm run lint` — no errors
- [ ] `npm run test` — all tests pass
- [ ] `npm run build` — builds successfully
- [ ] New logic has unit tests (if applicable)

---

## Screenshots / recordings

<!-- For UI changes, include a before/after screenshot or screen recording. -->

---

## Notes for reviewers

<!-- Anything the reviewer should pay special attention to. -->
