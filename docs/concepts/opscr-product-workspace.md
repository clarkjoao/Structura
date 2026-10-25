# opscr product workspace — initiatives as branches

Design brief agreed on 2026-10-24 (grill session; log in `.grill/opscr-product-workspace.md`).
Read [opscr-integration.md](opscr-integration.md) first: it explains how opscr and Structura work
today. This page says what we build next and why. Nothing here is implemented yet.

## The user and the job

One **architect** owns one **product** (example: "the architect of the Claude Code CLI inside
Anthropic"). Four squads build it, in a multirepo setup: one repo per service, one Terraform repo,
and one **documentation git repo** that holds the architecture. The architect cannot attend every
inception, so the YAML is the architect's source of truth and must always reflect what is in
production (AS-IS). How the YAML is kept current is out of scope (other processes do that).

The architect works through **two channels with the same power**:

- **Web:** Structura, opscr pane, bound to the documentation repo folder.
- **Terminal / VSCode:** Claude Code with the opscr skill, plus the `opscr` CLI.

The **LLM is the main author** of the YAML; the architect reviews. Every convention below must be
something the LLM cannot get wrong without `opscr compile` telling it.

Far future (do not build, but do not block): the YAML is the recipe for the Terraform modules.

## Decisions

### 1. One repo = one product, flat root = AS-IS

```
claude-code-arch/                 ← the documentation repo, one product
  opscr.workspace.yaml            ← declares the product and the initiatives folder
  opscr.layout.json               ← positions of the AS-IS
  product.opscr.yaml              ← Product/claude-code
  session-api.opscr.yaml
  agent-runtime.opscr.yaml
  platform-auth.opscr.yaml        ← ExternalSystem: a neighbouring product
  views.opscr.yaml                ← C1, C2, Deployment
  ...                             ← every AS-IS manifest, side by side, no subfolders
  initiatives/
    remote-sessions/
      initiative.opscr.yaml       ← Initiative/remote-sessions, with its status
      initiative.lock             ← base hashes of copied manifests (written by tools, not the LLM)
      opscr.layout.json           ← positions of what is new or moved only
      session-store.opscr.yaml    ← replaces Database/session-store of the root
      remote-sessions-edges.opscr.yaml  ← Relationship with the new edges only
```

- The **root holds only what is in production.** Nothing planned lives there.
- **`initiatives/` is the only folder with meaning.** There are no other folders, not even for
  humans (no `domains/`, no `external/`). The domain of an element comes from its `belongsTo`
  edge, never from its path. Moving a file never changes the architecture.
- Other products are **not** mapped. A neighbouring product appears as an `ExternalSystem`; what
  you call or consume on it (Kafka topics, API gateways) belongs to it via `belongsTo`. "External"
  comes from the Kind, so a future Terraform generator treats it as a `data` source, never a
  `resource`. Contracts (OpenAPI, AsyncAPI, schema registry) are **not** brought in now.

```yaml
# opscr.workspace.yaml
product: claude-code
initiatives: initiatives/
```

### 2. New schema pieces (opscr)

- **`Product`** Kind: the box of the C1 diagram, root of the hierarchy product → bounded contexts.
  `Domain` / `Subdomain` stay optional (the skill already says: not for simple systems). C2 groups
  elements in `BoundedContext` frames.
- **`Initiative`** Kind, one per initiative folder:

  ```yaml
  kind: Initiative
  metadata:
    name: remote-sessions
    links: { docs: https://… }          # PRD, RFC, ADR
  spec:
    status: proposed | approved | in-progress | done
  ```

  **The lifecycle belongs to the initiative, not to the element.** Elements have no `lifecycle`
  field. `proposed` = under discussion; `approved` / `in-progress` = roadmap; `done` = promoted.
- **`metadata.links`** on every Kind, both optional (a moonshot has no repository yet):

  ```yaml
  metadata:
    name: session-api
    links:
      repository: https://github.com/acme/session-api
      docs: https://docs.acme.dev/session-api
  ```

  Structura shows them as clickable links in the element panel.
- **Edge type `realizes`** (physical → logical), for the 1:N link between C2 and Deployment. In C2,
  `session-api` is one technology-free box; in Deployment it is an API Gateway, a Lambda, a DLQ…
  each one `realizes` it.

  ```yaml
  - { from: { kind: APIGateway, id: session-gw },  to: { kind: Application, id: session-api }, type: realizes }
  - { from: { kind: Application, id: session-fn }, to: { kind: Application, id: session-api }, type: realizes }
  ```

### 3. Initiatives are overlays: "branches" over a live main

An initiative folder holds **only the delta**, written as **ordinary manifests**; there is no patch
syntax for the LLM to get wrong.

| Intent | What the initiative holds |
| --- | --- |
| Add an element | a manifest with a new `metadata.name` |
| Change an element | the **whole** manifest with the **same `Kind/name`** as the root; it replaces it |
| Remove an element | the same `Kind/name` with only `metadata.retired: true` (exact field to settle in the spec); its edges disappear with it |
| Add edges | the initiative's own `Relationship` with the new edges only; edges **add up** (identity = `from, to, type`) |
| Remove an edge between two live elements (rare) | replace that `Relationship` of the root by name — hence the AS-IS keeps **one small `Relationship` per bounded context**, never one giant file |

Rule for the skill: **an element replaces, an edge adds.**

- Merge = root + initiative, compiled as one normal workspace. Errors go back to the LLM in the
  existing 3-attempt loop.
- **One diff function in `opscr/core`:** `diffWorkspace(root, root+initiative)` → `added /
  modified / retired`. It feeds the Structura Version, `opscr promote` and, one day, the Terraform
  plan.
- **Live overlay, unlike git:** a change to the root is seen by every initiative at once, with no
  rebase. The blind spot is copy-on-write: an element copied into an initiative in January
  overwrites a root change made in February. So **`initiative.lock`** records the hash of each
  root manifest when it is copied. `compile` warns when the root changed since; Structura shows a
  conflict badge and **blocks promote** until the architect chooses (keep initiative, take root,
  edit).
- Two open initiatives replacing the same `Kind/name`: compile **warns**, the Version picker shows
  it; nobody resolves it automatically (proposed, not confirmed — see open questions).
- **Promote = whole initiative only**, when it goes to production (`status: done`). Files move onto
  the root (`retired` ones delete root files / edges), the layout sidecar is merged, the folder is
  deleted. The architect commits. Being 1–2 sprints behind until the whole feature ships is
  accepted. Partial promote (`--only Kind/name`) is out of scope for now.
- Git keeps the history: the promote commit **is** the record that the initiative went live.

### 4. Three diagrams per product, by rule

| Diagram | Audience | View | Shows (by rule, no include list) |
| --- | --- | --- | --- |
| C1, business | business | `SystemContext` | `Product` + `Person` + `ExternalSystem` linked to it |
| C2, how the pieces talk | area manager | `Container` | logical elements: those that do **not** `realizes` anything; no `DeploymentNode`, no `Component` |
| Deployment | squads, architect | `Deployment` (`environment: production`) | `DeploymentNode` + physical elements: those **not realized by** anything |

- An element without `realizes` appears in both C2 and Deployment (a plain database is the same at
  both levels). `realizes` is used only when one logical piece becomes N physical ones.
- Navigation: C1 → drillDown (product box) → C2 → drillDown (a logical box) → Deployment,
  highlighting what realizes it.
- **Deployment draws production only.** Other environments are "reduced prod"; their variation
  becomes Terraform parameters later, not drawings. The architect needs production to plan the
  next initiatives.
- **C2 edges are declared** (needed for moonshots, drawn before any infra exists). Edges derived
  from Deployment by lifting physical edges through `realizes` are a **check**: `compile` warns
  when Deployment has a conversation that C2 lacks, or the reverse.
- An initiative shows in **all three** diagrams at once: pick "remote-sessions" and each diagram
  shows its share of the delta. Initiatives never touch the Views.
- Extra hand-made Views keep `include` / `exclude`.

What the View schema already has (`schemas/opscr.dev/v1/view.schema.yaml`): the level decides what
is shown by default, `scope` (today `BoundedContext` or `Domain`), `include` / `exclude`,
`environment`, `drillDown`. To change: `scope` may be a `Product`; the levels learn `realizes`; the
`x-opscr-usage` text says "one View per file under views/", which contradicts the flat root.

### 5. Structura Versions become the initiative UI

The Version feature (formerly Scene / Cena) has **no users today** and may be refactored 100%.

Today: `VersionDiff` in `src/features/diagram/model/diagram.types.ts:141` (`addedComponents`,
`addedConnections`, `removedComponentIds`, `removedConnectionIds`, `nodeLayouts`, `viewport`);
slice `src/features/diagram/store/slices/versions.slice.ts` (`addVersion`, `duplicateVersion`,
`setActiveVersion`, `setCompareVersion`, `mergeVersionIntoBase`, …); helpers
`src/features/diagram/utils/version.utils.ts`, `version-mutations.ts`; compare mode in the Canvas.
The plugin API (1.13.0) does not expose Versions.

Target — **a Version is a logical git branch, same semantics in both worlds:**

| Concept | Plain diagram (store) | opscr diagram (folder) |
| --- | --- | --- |
| main | base snapshot | root |
| branch | Version with `added / modified / removed` | `initiatives/<name>/` |
| status | `proposed → approved → in-progress → done` | `Initiative.spec.status` |
| conflict | base hash kept in the `VersionDiff` | `initiative.lock` |
| merge | apply the delta to the base | `promote` |

- Versions stay **generic** (they still work on diagrams without opscr). For a bound diagram the
  **plugin owns the Versions** through a new plugin API: it creates them from `initiatives/*`, and
  their actions (edit, promote, create a new initiative) become files.
- `VersionDiff` gains **`modified`**, filled from `diffWorkspace`, not from the canvas.
- Version picker groups by status; shows conflict badges.

In the opscr pane:

- Binding a folder shows the **root (AS-IS) as the base, editable** as today.
- Selecting a Version = editing that initiative, **copy-on-write**: editing a root-only element
  copies its manifest into the initiative (recording the lock hash) and patches it there; deleting
  writes the `retired` stub; a new connection goes into the initiative's own `Relationship`; the
  root is never touched.
- "New initiative" creates the folder + `Initiative` manifest. "Promote" calls the same core
  function as the CLI.
- The pane reads top-level files only today; it must also read `initiatives/*/`.

### 6. The skill (LLM rules)

The bundled `opscr-architect` skill must teach, in short:

- The meaning is in the YAML, never in the path. The only folder is `initiatives/<name>/`.
- AS-IS changes go to the root; anything planned goes into an initiative.
- An element replaces (same `Kind/name`, whole manifest); an edge adds; removal = `retired` stub.
- Never write `initiative.lock`.
- C2 is logical and technology-free; Deployment is physical; link them with `realizes`.
- One `Relationship` per bounded context in the root.
- Fill `metadata.links` when the user gives a repository or a doc URL.

## Build order

| # | Slice | Where |
| --- | --- | --- |
| 1 | Kinds `Product`, `Initiative`; `metadata.links`; edge `realizes`; `opscr.workspace.yaml` | opscr schemas |
| 2 | Overlay: load root + `initiatives/*`, merge rules, `diffWorkspace`, lock, `opscr promote` | `opscr/core` + CLI |
| 6 | Skill rules | opscr skill (then `npm run build-skill` in the plugin) |
| 3 | Rule-based Views (C1/C2/Deployment with `realizes`, Product scope) | `opscr/core` + `src/lib/opscr-mapping` |
| 4 | Versions refactored as branches (generic, `modified`, status, base hash, merge) + plugin API | Structura host |
| 5 | Pane: read `initiatives/`, Version = initiative, copy-on-write, promote in the UI | plugin opscr |

**Start with 1 + 2 + 6, all on the opscr side**, proven through the CLI and Claude Code (write an
initiative, compile, see the diff as text, promote). That validates the merge rules before any UI
is built on them. Then 3; then 4 + 5, the largest and riskiest. Each slice is an OpenSpec change.

## Open questions

- Initiative vs initiative conflicts: warning only (proposed) — confirm.
- The exact removal stub field (`metadata.retired: true` vs a field on `Initiative` listing
  removed `Kind/name`s).
- `Product` spec fields, and whether `Product` replaces `BoundedContext`/`Domain` as the View
  `scope` or adds to it.
- Which Kinds are "physical by nature" (APIGateway, LoadBalancer…) vs logical, and whether
  `Application.spec.provider` stays on the logical box or moves to the realizing element.
- Name collisions: identity is a global `Kind/name`; neighbouring products' topics may clash with
  ours.
- `opscr promote` on a dirty git tree: refuse or allow.
- How the VSCode preview shows initiatives (read-only Version picker?).
- Terraform: which fields a physical element needs so it can become a module. Far future.

## Out of scope (for now)

- Bringing contracts (OpenAPI / AsyncAPI / schema registry) into `external` elements.
- Partial promote of an initiative.
- Mapping the whole company; only the product the architect owns.
- Environment variants in the Deployment diagram.
- Keeping the YAML current (other processes own that).
- Chat in VSCode (earlier decision: Claude Code edits the files there).
- Generating Terraform.

## How to start the next session

> Read `docs/concepts/opscr-integration.md` and `docs/concepts/opscr-product-workspace.md`.
> Implement slice 1 (+2, +6) in `~/www/opscr` on a new branch, as an OpenSpec change. Build a test
> workspace like `examples/web-app-aws` reshaped as a product (flat root + one initiative that adds,
> changes and retires elements) and prove it with `opscr compile` and `opscr promote`.
