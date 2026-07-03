# Tasks: Plugin System Foundation (RFC, spec-only)

This change is spec-only: every task below is a documentation or validation task. No task creates or modifies anything under `src/` — implementation belongs to a later OpenSpec change scoped from this RFC.

## 1. RFC internal consistency

- [x] 1.1 Cross-check `design.md` against TODO.md F-02: two plugin kinds, the five drafted API methods, local-file MVP distribution, `structura-plugin-*` npm convention, and the RFC-first warning are all encoded, not redesigned
- [x] 1.2 Cross-check `design.md` against `docs/architecture/plugin-system-preparation.md` and record explicitly which stance is superseded (runtime local-file loading vs static compilation) and which philosophy is carried forward
- [x] 1.3 Verify every requirement in `specs/plugin-system/spec.md` traces to a decision in `design.md`, and every D4 API method has a corresponding registration-contract requirement

## 2. Validation against real use cases

- [x] 2.1 Walk through a DefectDojo-style plugin (today's `src/integrations/defectdojo/`) against the proposed API; where the walkthrough exposes a gap, fix the API design in `design.md` (result: added `api.storage`, `PluginPanelContext.updateService`, `service-registry-import` slot)
- [x] 2.2 Walk through a Mermaid-import-style plugin (today's `import-mermaid-flowchart.ts` path) against the proposed API; where the walkthrough exposes a gap, fix the API design in `design.md` (result: added `ImportContext` with existing components/connections and anchor)
- [x] 2.3 Maintainer reviews both walkthroughs and confirms the "expressible" verdicts (including the accepted residual differences noted in each walkthrough) — confirmed with the archive decision, 2026-07-03

## 3. Structural validation

- [x] 3.1 `openspec validate add-plugin-system-foundation --strict` passes
- [x] 3.2 `git status` confirms no files under `src/` were created or modified by this change

## 4. Maintainer review & sign-off (gates Phase 2)

- [x] 4.1 Maintainer sign-off on the public API surface (D4: five TODO.md methods + `storage`; argument shapes; throw-on-duplicate semantics; `void` returns with host-tracked ownership) — signed off via archive decision, 2026-07-03
- [x] 4.2 Maintainer sign-off on the manifest schema and capability list (D2) — this is the format a future marketplace/sandbox must stay compatible with — signed off via archive decision, 2026-07-03
- [x] 4.3 Maintainer sign-off on the trust model documentation (D6), including the honest statement that the no-direct-store-access rule is unenforced in the MVP — signed off via archive decision, 2026-07-03
- [x] 4.4 Maintainer sign-off on the future folder layout (D8) and on the inventoried prerequisites in existing code (registry unregistration, reactive `nodeTypes`, exporter/importer registry) — signed off via archive decision, 2026-07-03
- [x] 4.5 Decide whether to archive this change (merging the delta into `openspec/specs/plugin-system/spec.md` as source of truth) or keep it open for further review — decision: archive, 2026-07-03
- [ ] 4.6 After archiving: decide whether to add a one-line pointer under TODO.md F-02 to the archived spec so the two tracking sources don't diverge — pending maintainer answer
