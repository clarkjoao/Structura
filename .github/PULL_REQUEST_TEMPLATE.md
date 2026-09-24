## Summary

<!-- What does this PR change, and why? -->

Closes #

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / performance
- [ ] Documentation
- [ ] Tests
- [ ] CI / tooling / dependencies

## Checklist

See [CONTRIBUTING.md](../CONTRIBUTING.md#rules-the-code-follows) and [AGENTS.md](../AGENTS.md).

- [ ] Type guards from `@/features/diagram` instead of `type === "..."` string checks
- [ ] No hardcoded UI strings — new keys added to both `en.json` and `pt-BR.json`
- [ ] Structural store mutations call `pushHistory`; persisted schema changes include a migration
- [ ] Persistence goes through `IStoragePort` (no direct `localStorage` outside `infrastructure/persistence`)
- [ ] Left handles stay inputs and right handles stay outputs
- [ ] New logic has tests, and a bug fix has a test that fails without the fix
- [ ] Docs updated where behavior changed (`docs/`, `README.md`, `CHANGELOG.md` under _Unreleased_)

## Checks

- [ ] `npm run typecheck`
- [ ] `npm run lint` and `npm run format:check`
- [ ] `npm test`
- [ ] `npm run build`

## Screenshots / recordings

<!-- For UI changes, include a before/after screenshot or a short recording. -->

## Notes for reviewers

<!-- Anything that deserves extra attention. -->
