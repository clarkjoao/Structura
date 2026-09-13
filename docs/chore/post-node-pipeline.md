# Post-merge cleanup — L1, L2, L3

Branch `chore/post-node-pipeline`, based on `main` at `aad2d0b`. Three commits, one per item.

## 1. Result in three lines

- **L1** — The three share-url/viewer suites were wrong, not flaky: they extracted the share payload with a raw string split, skipping the percent-decode the app performs through `URLSearchParams`. Fixed in the tests; production code untouched. 10 failures → 0.
- **L2** — `commitNodeDrag` removed: implementation, type declaration, two store action-list entries, two dedicated tests, and five documentation mentions. `grep -rn "commitNodeDrag" src/` returns nothing.
- **L3** — `AGENTS.md` now records why `batchUpdateNodeLayouts` deliberately writes no history checkpoint, placed directly beneath the `pushHistory` hard rule it qualifies.

## 2. L1 — the three share-url/viewer suites

### What was wrong

`generateShareUrl` builds the payload like this (`src/lib/share-url/encode.ts:69`):

```ts
const encoded = encodeURIComponent(LZString.compressToEncodedURIComponent(json));
```

The `encodeURIComponent` wrapper was added by PR #210 (`35f1dda`). It is necessary. LZString's URI-safe alphabet contains `+`, and a raw `+` inside a URL hash is read back as a space, so the payload decompressed into *silently wrong data* rather than failing cleanly.

Measured, with a payload whose compressed form contains `+`:

```
raw payload (contains '+'): N4IgdiBcAMA0IGcogCoFMEBcAEARAlgIYDmAToQLYgC+QA
no-encode -> URLSearchParams returns: N4IgdiBcAMA0IGcogCoFMEBcAEARAlgIYDmAToQLYgC QA
no-encode round-trips?  false   ('+' became: ' ')
no-encode decompresses? true          <-- decodes to corrupt data, no error

encoded   -> URLSearchParams returns: N4IgdiBcAMA0IGcogCoFMEBcAEARAlgIYDmAToQLYgC+QA
encoded round-trips?  true
encoded decompresses? true
```

The app removes that layer on the way back in, via `getShareParamFromUrl` → `currentHashParams()` → `new URLSearchParams(hash).get("share")`, which percent-decodes. Encode and decode are symmetric through the real path.

The three suites did not use that path. They did:

```ts
const shareParam = result.url.split("#share=")[1];
```

which leaves the payload still percent-encoded, so `decodeShareParam` could not decompress it and returned `null` — the `AssertionError: expected null to be truthy` seen in every prior session.

### Why it looked flaky

It only fails when the compressed bytes happen to contain a character `encodeURIComponent` escapes. The fixtures stamp `createdAt: Date.now()`, so the payload changes every run. Measured over 300 payloads from the same fixture shape:

```
payloads altered by encodeURIComponent: 235/300
```

About 78% of runs fail, and which assertions fail moves around — the reported 8–10 failure band. Nothing was ever timing-dependent.

The decisive evidence that production was correct: within `share-url.test.ts`, the one test that already passed (`should extract share param from URL`) is the one that goes through `getShareParamFromUrl()` and therefore through `URLSearchParams`.

### What was fixed

Test-side only. Each file now extracts the payload the way the app does:

```ts
const shareParamOf = (url: string) => new URLSearchParams(url.split("#")[1]).get("share")!;
```

- `src/lib/share-url/share-url.test.ts` — helper added, 3 call sites.
- `src/lib/diagram-url.flow.test.ts` — `payloadOf` rewritten (its manual `.split("&")[0]` is now handled by `URLSearchParams`).
- `src/features/viewer/viewer-opens-on-base.test.ts` — helper added, 6 call sites.

No production file changed in this commit. No assertion was weakened or deleted; all 22 tests still assert what they did before.

### Confirmation

The three files alone, 8 consecutive runs (against a ~78% per-run failure rate before the fix):

```
run 1: Tests 22 passed (22)      run 5: Tests 22 passed (22)
run 2: Tests 22 passed (22)      run 6: Tests 22 passed (22)
run 3: Tests 22 passed (22)      run 7: Tests 22 passed (22)
run 4: Tests 22 passed (22)      run 8: Tests 22 passed (22)
```

Full `npm test`, 3 consecutive runs on the final branch state:

```
run 1: EXIT=0   Tests 1901 passed (1901)
run 2: EXIT=0   Tests 1901 passed (1901)
run 3: EXIT=0   Tests 1901 passed (1901)
```

No production bug was found, so there was nothing to stop and report under the L1 escalation rule.

## 3. L2 — removing `commitNodeDrag`

### grep before

```
src/test/stress-panels.test.ts:115,120,180,291,294
src/features/diagram/store/diagram.store.ts:205,281
src/features/diagram/store/slices/component-parenting.slice.ts:106
src/features/diagram/store/slices/drag-commit-history.test.ts:7        (comment only)
src/features/diagram/store/README.md:83
src/features/diagram/store/actions.types.ts:134
src/features/canvas/hooks/useNodeDragParenting.singleCommit.test.tsx:10 (comment only)
src/features/canvas/hooks/useNodeDragParenting.ts:56                    (comment only)
```

No caller in any app path — only tests, declarations, and prose. Premise confirmed.

### grep after

```
$ grep -rn "commitNodeDrag" src/
(no results)

$ grep -rn "commitNodeDrag" . --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git
(no results)
```

`batchCommitNodeDrag` is untouched — 48 references remain in `src/`. The case-sensitive grep does not match it.

### What was removed

- **Implementation** — `component-parenting.slice.ts`, 20 lines. The shared `applySingleNodeDrag` helper stays; `batchCommitNodeDrag` is now its only caller.
- **Type** — the `commitNodeDrag` declaration in `actions.types.ts`.
- **Store wiring** — entries in `selectDiagramActions` and `selectLayoutActions` in `diagram.store.ts`.
- **Tests removed** (existed only to cover the function): `commitNodeDrag atomically updates parentId and position` and `commitNodeDrag on 500-element diagram completes in under 100ms`, both in `stress-panels.test.ts`. Each has a `batchCommitNodeDrag` sibling that covers the same ground.

### What was kept

`undo/redo preserves all 500 component positions` uses the commit only as a way to make a change before asserting on undo — incidental, per the "if in doubt, keep" rule. It was kept and moved onto `batchCommitNodeDrag` with a single entry, so the 500-component undo assertion stays live.

Test count 1903 → 1901, exactly the two removed; file count unchanged at 205.

### Documentation

Two of the mentions were not stale prose but active, and now-wrong, instructions:

- `CONTRIBUTING.md` gave `commitNodeDrag(nodeId, position)` as the ✅ CORRECT way to commit a node drag → now `batchCommitNodeDrag([{ nodeId, newParentId, newPosition }])`.
- `.github/PULL_REQUEST_TEMPLATE.md` had a non-negotiable checklist item requiring `commitNodeDrag()` → now requires `batchCommitNodeDrag()`.

Also updated: `store/README.md` structural-history list, `docs/concepts/canvas-hot-path.md` Don't-column, and three code comments that named the action (in `drag-commit-history.test.ts`, `useNodeDragParenting.ts`, `useNodeDragParenting.singleCommit.test.tsx`).

## 4. L3 — the `AGENTS.md` entry

Added to **Hard rules**, immediately after the bullet requiring `pushHistory` — the rule it is an exception to, and the one that would otherwise make this action look like a defect:

```markdown
- **`batchUpdateNodeLayouts` writes no history, deliberately.** It writes a whole
  batch of re-measured node dimensions in a single transaction, and skips
  `pushHistory` for the same reason single-node `updateNodeLayout` does — writing
  many nodes at once does not make it an edit. React Flow re-measures through a
  `ResizeObserver`, so one store change can hand the canvas a dimension change per
  node on screen: that is the canvas reporting the size it just painted, not an
  edit the user made. Checkpointing it would put entries in the undo stack that
  the user never caused and cannot meaningfully undo, and writing the batch one
  `updateNodeLayout` at a time costs one `set()` each — every `set()` serialises
  the whole workspace for the persist middleware. Do not add a history checkpoint
  here, and do not split the batch, without a measurement that justifies it.
```

Each claim was checked against the code rather than taken from the brief:

- *writes re-measured dimensions in one transaction* — `layout.slice.ts:62`, one `set()` looping over all entries.
- *no `pushHistory`* — confirmed absent from the action body.
- *fed by the ResizeObserver* — `useNodeDragParenting.ts:177`, `batchUpdateNodeLayouts(entries)` flushing `pendingLayoutUpdatesRef`.
- A first draft called it "the only layout action that skips `pushHistory`". That is false — `updateNodeLayout`, `updateViewport`, `bringToFront` and `sendToBack` skip it too — and was corrected before the commit.

## 5. NOT VERIFIED

- **Runtime behaviour in a browser.** Everything here is covered by `npm test`, `npm run typecheck` and `npm run build`; no dev server was started and no browser was opened, so no app window was disturbed. Port 8080 was never bound.
- **`npm run lint`** was not run. It is not one of the four gates set for this task, and per the standing note on this repo the lint gate is green only by suppression, so a pass would not have meant much either way.
- **Cypress** (`cypress/e2e/stress-*`) was not run — outside the gates set for this task.
- **The `+`-in-hash corruption was reproduced in jsdom**, through the same `URLSearchParams` implementation the app uses, not in a real browser address bar.

## 6. Final state

**Branch:** `chore/post-node-pipeline`, based on `main` at `aad2d0b`. No PR opened. No other branch, tag or remote touched. No `git stash` used at any point.

**Commits:**

```
806b341 docs(agents): record why batchUpdateNodeLayouts writes no history
59d9bf4 refactor(store): remove the unused commitNodeDrag action
41ec92c test(share-url): read the share param the way the app does
```

One commit per item, as asked, plus a fourth carrying this report.

**Gates** — run per commit; final state shown:

| Gate | Result |
| --- | --- |
| `npm run typecheck` | EXIT=0 |
| `npm test` | EXIT=0 — 205 files, 1901 tests, 3 consecutive clean runs |
| `npm run build` | EXIT=0 |
| `npx prettier --check` (touched files) | EXIT=0 — all formatted |

**`git status --porcelain`**

- At start: empty (clean).
- At end: empty (clean) — everything committed.

**`lsof -i :8080 -sTCP:LISTEN`**

- At start: no listener.
- At end: no listener.
