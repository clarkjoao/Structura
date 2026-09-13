# Tech debt base — lint, prettier, domínio/UI, tools/perf

Branch: `chore/tech-debt-base` (from updated `main`). Date: 2026-09-13.

## 1. Resultado em quatro linhas

1. **Prettier:** 11 arquivos formatados; `prettier --check 'src/**/*.{ts,tsx}'` exit 0.
2. **Lint:** sete regras `react-hooks/*` de `"off"` → `"warn"`; baseline real abaixo; `npm run lint` completa (exit 1 por avisos/erros pré-existentes).
3. **Domínio/UI:** zero `from "react"` em `features/diagram`; seletores sem `useMemo`; efeito do storage monitor no canvas.
4. **tools/perf:** 28 scripts `.mjs` + `README.md` versionados; fixtures grandes fora do repo.

## 2. Item 1 — Prettier

**Baseline:** 11 arquivos fora de formato (`npx prettier --list-different 'src/**/*.{ts,tsx}'`).

Arquivos formatados:

- `src/features/canvas/components/icons/AwsIconPickerPanel.tsx`
- `src/features/canvas/hooks/keyboard/canvasKeydownGates.ts`
- `src/features/canvas/hooks/keyboard/createToolShortcuts.ts`
- `src/features/canvas/hooks/keyboard/dispatchCanvasKeydown.ts`
- `src/features/canvas/hooks/keyboard/runClaimingChain.ts`
- `src/features/canvas/hooks/resolve-wheel-intent.ts`
- `src/features/canvas/hooks/useCanvasKeyboard.ts`
- `src/features/canvas/panels/ElementPanel/ComponentPanel.tsx`
- `src/features/canvas/panels/ElementPanel/components/TabBar.tsx`
- `src/features/canvas/panels/ElementPanel/JsonViewerPanel.tsx`
- `src/features/canvas/toolbar/element-picker/utils.ts`

**Commit:** `4a4d82b` — `chore: format source files with prettier`

**Portões:** typecheck 0, test 0 (206 files / 1913 tests), build 0, prettier check 0.

## 3. Item 2 — Reativar regras como aviso

**Baseline lint (antes da mudança):** 31 problems (2 errors, 29 warnings) — regras reativadas ainda `"off"`.

Mudança em `eslint.config.js`: as sete regras passaram de `"off"` para `"warn"`. Nenhuma violação foi corrigida.

**Após reativar — baseline real do projeto:**

| Regra | Avisos |
| --- | ---: |
| `react-hooks/refs` | 101 |
| `react-hooks/set-state-in-effect` | 51 |
| `react-hooks/immutability` | 14 |
| `react-hooks/exhaustive-deps` | 12 |
| `react-hooks/preserve-manual-memoization` | 5 |
| `react-hooks/static-components` | 5 |
| `react-hooks/purity` | 1 |
| **Soma das sete** | **189** |

`npm run lint` total: **220 problems (2 errors, 218 warnings)**. Os 2 errors e ~29 warnings restantes já existiam (ex.: `react-refresh/only-export-components`, `@typescript-eslint/no-unused-vars`, `react-hooks/globals`). Exit code 1 (esperado com avisos/erros).

Typecheck e build **não** quebraram com `"warn"`.

**Commit:** `7de8f99` — `chore(lint): re-enable react-hooks rules as warnings`

**Portões:** typecheck 0, test 0, build 0; lint exit 1 (esperado).

## 4. Item 3 — React fora de `features/diagram`

Critério: `grep -rn 'from ["'\'']react["'\'']' src/features/diagram/` → zero resultados. Atendido.

| Arquivo | Mudança |
| --- | --- |
| `diagram.selectors.ts` | Removido `useMemo` de `useAllDiagrams`; agora `useShallow((s) => Object.values(s.diagrams))`. |
| `connection.selectors.ts` | Removido `useMemo` de `useVisibleComponents` / `useVisibleConnections`; filtro feito dentro de um único seletor `useShallow`. |
| `useStorageMonitor.ts` (diagram) | Hook com `useEffect` virou `startStorageMonitor()` puro (timers + cleanup). |
| `canvas/hooks/useStorageMonitor.ts` (novo) | Hook UI chama `startStorageMonitor()` no efeito. |
| `diagram/store/index.ts` | Exporta `startStorageMonitor` em vez de `useStorageMonitor`. |
| `canvas/index.ts` | Reexporta `useStorageMonitor`. |
| `WorkspaceContent.tsx` | Importa o hook de `@/features/canvas`. |

Arquivos tocados no item: 7 (≤5 só para o move do monitor sozinho: 5; seletores + move no mesmo commit). Sem colaboração / persistência / histórico além do monitor de storage já existente.

**Commit:** `8c01d74` — `chore: remove React imports from features/diagram`

**Portões:** typecheck 0, test 0, build 0.

## 5. Item 4 — `tools/perf/`

**Decisão:** versionar `tools/perf/` no repo (não adicionar ao `.gitignore`). Documentado no README. Fixtures JSON grandes **não** são commitadas; regenerar com `SEED = 20260911`.

Não existe `make-fixture-L.mjs` no scratch; P/M/G/XG vêm de `make-fixtures.mjs`, M2 de `make-fixtures-m2.mjs`.

### Scripts copiados (28 `.mjs`)

De `~/structura-scratch/build-nodes/`:

- `bisect-measure.mjs`, `cleanup.mjs`, `count-edge-sets.mjs`, `count-qs.mjs`, `count-selectable.mjs`
- `diag-c.mjs`, `diag-serial.mjs`, `diag-store.mjs`, `diag-xg.mjs`
- `launch-dev.mjs`, `launch-preview.mjs`, `make-fixtures.mjs`
- `measure.mjs`, `measure2.mjs`
- `verify-drag-commit.mjs`, `verify-pagehide.mjs`, `verify-persist.mjs`, `verify-viewer-labels.mjs`, `watch-drag-persist.mjs`

De `~/structura-scratch/virtualizacao/`:

- `cleanup-8199.mjs`, `make-fixtures-m2.mjs`, `make-fixtures-sweep.mjs`
- `probe-commit-until-quiet.mjs`, `probe-commit.mjs`, `probe-idle.mjs`, `probe-loop.mjs`, `probe-persist.mjs`, `profile-commit.mjs`

### Conteúdo do README (`tools/perf/README.md`)

Texto completo no commit `86edbf7` em `tools/perf/README.md` (reproduzido abaixo, sem fences internos):

---

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

    # preview (typical for measurements)
    node tools/perf/launch-preview.mjs /tmp/structure-8199.log /tmp/structure-8199.pid

    # or vite dev on the same port
    node tools/perf/launch-dev.mjs /tmp/structure-8199.log /tmp/structure-8199.pid

    # stop only that launcher PID
    kill "$(cat /tmp/structure-8199.pid)"

Clear site storage on that origin (does not kill the server):

    node tools/perf/cleanup.mjs
    # or
    node tools/perf/cleanup-8199.mjs

## Fixtures (seed `SEED = 20260911`)

There is **no** `make-fixture-L.mjs` in scratch — sizes come from these generators.
All use mulberry32 with **`SEED = 20260911`** so re-runs are byte-identical for a
given schema version.

    # P / M / G / XG → ~/structura-scratch/build-nodes/fixtures/{P,M,G,XG}.json
    node tools/perf/make-fixtures.mjs

    # M2 (1000n / 1300e) → same fixtures dir + seed-m2.json
    node tools/perf/make-fixtures-m2.mjs

    # Sweep sizes (virtualization epic) → make-fixtures-sweep.mjs
    node tools/perf/make-fixtures-sweep.mjs

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

    npm run build
    node tools/perf/launch-preview.mjs /tmp/structure-8199.log /tmp/structure-8199.pid
    node tools/perf/make-fixtures.mjs          # once per machine / schema bump
    node tools/perf/measure2.mjs G baseline /tmp/measure-G.json 7
    kill "$(cat /tmp/structure-8199.pid)"

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

---

**Commit:** `86edbf7` — `chore: add performance measurement scripts to tools/perf`

**Portões:** typecheck 0, test 0, build 0.

## 6. DECISÕES DO DONO

Nenhuma. Item 3 ficou dentro do limite (move do monitor = 5 arquivos de suporte; seletores triviais no mesmo commit).

## 7. NÃO VERIFICADO

- CI remota / PR checks (PR não aberto).
- Execução ponta a ponta dos scripts em `tools/perf/` (só versionados + README).
- Correção das 189 violações das sete regras (só medição).
- Paths absolutos `/Users/clark/www/Structura` dentro dos `.mjs` (documentados; não reescritos).
- `npm run lint` como portão verde (exit 1 esperado após item 2).

## 8. Estado final

| Campo | Valor |
| --- | --- |
| Branch | `chore/tech-debt-base` |
| Base | `main` @ `f9d0310` (ff-only atualizado) |
| Commits | `4a4d82b`, `7de8f99`, `8c01d74`, `86edbf7`, + este relatório (`docs: add tech-debt-base chore report`) |
| Autor | `clarkjoao <clark.joao@gmail.com>` — sem Co-authored-by / Claude |
| `git status --porcelain` inicial | vazio (em `main`) |
| `git status --porcelain` final | vazio |
| `lsof -i :8080 -sTCP:LISTEN` início | nenhum listener |
| `lsof -i :8080 -sTCP:LISTEN` fim | nenhum listener |
| Portões por item | typecheck / test / build / prettier nos tocados — OK |
| Navegador | não aberto |
| `git stash` | não usado |
