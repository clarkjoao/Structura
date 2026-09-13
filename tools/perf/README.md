# Performance measurement scripts (`tools/perf/`)

Versioned copies of the harnesses that lived in `~/structura-scratch/build-nodes/`
and `~/structura-scratch/virtualizacao/`. **This directory is committed** so future
sessions can reproduce the same numbers. Do **not** add `tools/perf/` to
`.gitignore`.

Large fixture JSON files (`G.json` ~167KB, `M2.json` ~0.4–2MB, `XG.json` ~2.1MB)
are **not** in the repo. Regenerate them locally (see below).

## Assumptions (as copied)

- App under test: `http://localhost:8199` (`--strictPort`).
- Playwright import paths and `launch-*.mjs` `cwd` still point at
  `/Users/clark/www/Structura` — adjust if your clone lives elsewhere.
- Fixtures and raw outputs default to `~/structura-scratch/build-nodes/fixtures/`
  (and related scratch dirs). Create that tree before measuring.
- Prefer **one** Chromium/Playwright browser instance; new tabs steal focus on
  this machine.
- Tear down only the PID written by `launch-dev.mjs` / `launch-preview.mjs`.
  Do not use `pkill` / `killall` / `killpg` / `fuser -k`.

## Port 8199 — start / stop

From the repo root (after `npm run build` if using preview):

```bash
# preview (typical for measurements)
node tools/perf/launch-preview.mjs /tmp/structura-8199.log /tmp/structure-8199.pid

# or vite dev on the same port
node tools/perf/launch-dev.mjs /tmp/structure-8199.log /tmp/structure-8199.pid

# stop only that launcher PID
kill "$(cat /tmp/structure-8199.pid)"
```

Clear site storage on that origin (does not kill the server):

```bash
node tools/perf/cleanup.mjs
# or
node tools/perf/cleanup-8199.mjs
```

## Fixtures (seed `SEED = 20260911`)

There is **no** `make-fixture-L.mjs` in scratch — sizes come from these generators.
All use mulberry32 with **`SEED = 20260911`** so re-runs are byte-identical for a
given schema version.

```bash
# P / M / G / XG → ~/structura-scratch/build-nodes/fixtures/{P,M,G,XG}.json
node tools/perf/make-fixtures.mjs

# M2 (1000n / 1300e) → same fixtures dir + seed-m2.json
node tools/perf/make-fixtures-m2.mjs

# Sweep sizes (virtualization epic) → make-fixtures-sweep.mjs
node tools/perf/make-fixtures-sweep.mjs
```

| Key | Approx size         | Notes                                   |
| --- | ------------------- | --------------------------------------- |
| P   | 20 nodes / 25 edges | Smoke                                   |
| M   | 100 / 130           | Mid                                     |
| G   | 400 / 550           | Main drag/commit baseline (~167KB JSON) |
| M2  | 1000 / 1300         | Virtualization epic                     |
| XG  | 5000 / 6500         | Stress (~2.1MB JSON) — do not commit    |

Payload shape: persisted `structura_diagram-store` (schema version baked into the
generator; bump generators if `PERSIST_SCHEMA_VERSION` moves).

## Typical measurement flow

```bash
npm run build
node tools/perf/launch-preview.mjs /tmp/structure-8199.log /tmp/structure-8199.pid
node tools/perf/make-fixtures.mjs          # once per machine / schema bump
node tools/perf/measure2.mjs G baseline /tmp/measure-G.json 7
kill "$(cat /tmp/structure-8199.pid)"
```

`measure2.mjs` usage: `node measure2.mjs <G|XG> <label> <out.json> [reps]`  
Each rep reloads the fixture so samples are independent.

## Script catalog

### Generators

| Script                    | Role                                |
| ------------------------- | ----------------------------------- |
| `make-fixtures.mjs`       | Deterministic P/M/G/XG fixtures     |
| `make-fixtures-m2.mjs`    | Deterministic M2 fixture            |
| `make-fixtures-sweep.mjs` | Sweep sizes for virtualization work |

### Launch / cleanup

| Script                             | Role                                                              |
| ---------------------------------- | ----------------------------------------------------------------- |
| `launch-preview.mjs`               | Detached `vite preview --port 8199 --strictPort`; writes PID file |
| `launch-dev.mjs`                   | Detached `vite --port 8199 --strictPort`; writes PID file         |
| `cleanup.mjs` / `cleanup-8199.mjs` | Clear `localStorage` on `:8199` via Playwright                    |

### Primary timers / profiles

| Script               | Role                                                     |
| -------------------- | -------------------------------------------------------- |
| `measure.mjs`        | Multi-pass baseline (DOM phases, CPU profile, nudge)     |
| `measure2.mjs`       | Corrected drag protocol: reload fixture each rep         |
| `bisect-measure.mjs` | Shorter G-fixture timing for bisect loops                |
| `diag-store.mjs`     | CPU profile around store activity (fixture arg)          |
| `diag-serial.mjs`    | Instrument `JSON.stringify` / `parse` during interaction |
| `diag-c.mjs`         | Instrument `localStorage` writes                         |
| `diag-xg.mjs`        | Long-budget XG load/profile + console error tally        |

### Counts / probes (virtualization & commit cost)

| Script                         | Role                                                  |
| ------------------------------ | ----------------------------------------------------- |
| `count-qs.mjs`                 | DOM node/edge/label-renderer counts after load        |
| `count-edge-sets.mjs`          | Store `set()` count during edge gestures              |
| `count-selectable.mjs`         | `elementsSelectable` RF-store read counts during drag |
| `probe-commit.mjs`             | Drag-commit long-task breakdown                       |
| `probe-commit-until-quiet.mjs` | Same until main thread quiet                          |
| `probe-loop.mjs`               | Drag-commit loop measured to silence                  |
| `probe-persist.mjs`            | `localStorage.setItem` volume in commit window        |
| `probe-idle.mjs`               | Idle control for recentDiagrams write loop            |
| `profile-commit.mjs`           | CDP self-time by function on commit (M2)              |

### Behaviour checks

| Script                     | Role                                           |
| -------------------------- | ---------------------------------------------- |
| `verify-drag-commit.mjs`   | Drag lands in store; undo restores             |
| `verify-persist.mjs`       | Persist round-trip after edit                  |
| `verify-pagehide.mjs`      | Persist on `pagehide` / related events         |
| `verify-viewer-labels.mjs` | Viewer URL edge-label DOM count                |
| `watch-drag-persist.mjs`   | Poll until persisted layout updates after drag |

## Prerequisites

- Node 18+
- `npm install` in the Structura repo (Playwright + `lz-string` resolved from
  that `node_modules`)
- Playwright browsers installed (`npx playwright install chromium` if needed)
