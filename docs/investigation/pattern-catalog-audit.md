# Pattern catalog refresh — Phase 0 audit

Read-only audit of the built-in architecture pattern catalog. Written against `main` @ `5dd1afc7`
(branch `feat/pattern-catalog-refresh`). Line numbers refer to that commit. Measurements in §5 were
taken in the running app (Vite + one Playwright instance, pt-BR, 1440×900).

> **Branch interaction.** The unmerged branch `feat/element-catalog-toolbar` deletes `PatternPicker`
> and moves patterns into the element catalog as a "Patterns" chip rendered by a separate
> `canvas/patterns/PatternBrowser`. It also adds the catalog *concepts* vocabulary (`queue`,
> `cache`, `database`…) that §4 proposes to reuse as pattern roles. Both facts drive open
> questions Q1–Q2.

---

## 1. Current state

| Point from the previous audit | Verified on `main` |
| --- | --- |
| `PatternTemplate` with 31 built-ins in `src/lib/catalogs/patterns.ts` | **30**, not 31 (`patterns.ts:52-1599`, 1614 lines) |
| Closed category enum | Yes: `PatternCategory = messaging \| api \| resilience \| data \| event-driven \| security` (`:34-44`); `PATTERNS_BY_CATEGORY` hand-lists the six keys (`:1601-1614`) |
| No icon or thumbnail | Yes. The picker draws a category emoji and a `PatternFlowPreview` (node names as chips) |
| PT content hardcoded with a TODO | Partly. `TODO(i18n)` at `:3-5`. Pattern **names, short descriptions, node names, node descriptions and edge labels are English literals**. The **note text of every pattern (30/30) is Portuguese** ("🔴 Problema / ⚙️ Como funciona / ✅ Quando usar") |
| `UserTemplate` and `ElementPreset` are separate | Yes. `UserTemplate` shares `insertPattern` but has its own payload branch (`patterns.slice.ts:46-80, 132-141`); `ElementPreset` is unrelated. Neither is touched by this plan |

**Types** (`patterns.ts:7-32`): `PatternComponent { type: ComponentType; name; description?; technology?; awsService?; cloudServiceId?; x?; y? }`, `PatternConnection { fromIndex; toIndex; label }`, `PatternTemplate { id; name; description; category; components; connections }`. There is no parent/child relation (unlike `UserTemplate.parentIndex`), so a pattern cannot draw a boundary (pod, cell, region) that contains other nodes.

**UI path (main).** `CanvasToolbar` "Patterns" button → `PatternPicker` modal (`canvas/toolbar/PatternPicker.tsx`): left category nav, substring search on name/description/component names, card list. Click → `insertPattern(template, getViewportCenter(rf))` (`:124-133`), then the created ids are selected. No provider choice. *(On `feat/element-catalog-toolbar` this becomes the catalog's Patterns chip; the insert call is the same.)*

**Store** (`diagram/store/slices/patterns.slice.ts:112-175`): one `set()`. `pushHistory(state, STRUCTURAL)` runs before any write unless a scene is active (same rule as `addComponent`). One undo already removes the whole fragment. Nodes are built by hand:

- `{ id, name, type, description, parentId: null, technology, ...cloudServiceIdWrite(cloudServiceId ?? awsService) } as Component` (`:89-97`). That is a **cast**, and it bypasses the descriptor's `createComponent`.
- The layout is `{ elementId, x: origin + raw.x, y: origin + raw.y }` (`:99-104`), with **no width/height**, so the descriptor's `defaultSize` is ignored.
- Connections get only `{ id, sourceId, targetId, label }` (`:29-36`): no edge style, no side.
- `insertPattern` never checks `isRegisteredElementType` or `canBeConnectionSource`.

**LLM** (`features/llm`):

- `insert_pattern(patternId)` (`tools.ts:155-170`), validated by `isValidPatternId` (`component-catalog.ts:256`) in `patch-parser.ts:165-174`, and applied at a **fixed `{x: 300, y: 300}`** (`apply-diagram-patch.ts:124-139`).
- The system prompt lists ids per category through `buildPatternCatalogCompact()` (`component-catalog.ts:233-250`, used by `prompt-builder.ts:236`). This is already derived from `PATTERNS`, not duplicated.
- **`list_patterns` is declared in `tools.ts:31-35` but has no handler**: there is no `case "list_patterns"` in `patch-parser.ts`, and it is not in `CATALOG_READ_TOOL_NAMES`. The model is told to call a tool that does nothing. `insert_pattern`'s own description says "Use list_patterns first".

## 2. Inventory (30 patterns)

All node types are registered (checked with `isRegisteredElementType`). No pattern uses the legacy `awsService` field: 20 nodes use `cloudServiceId`. No edge references a missing node. Every pattern starts with a `note`.

| id | cat | nodes/edges | element types (besides `note`) | maps to | notes |
| --- | --- | --- | --- | --- | --- |
| fifo-queue-aws | messaging | 4/2 | container, aws-integration(sqs) | — (queue property) | AWS-only copy; ordering is queue **config** → Tier C |
| fifo-queue-kafka | messaging | 4/2 | container, aws-analytics(msk) | — | Kafka named but drawn as MSK; same pattern as above |
| dead-letter-queue-aws | messaging | 5/3 | aws-integration, aws-compute, aws-management | EIP Dead Letter Channel | AWS-only; good topology |
| fan-out | messaging | 5/3 | aws-integration ×4 | A: Fan-out | AWS-only; **no workers** behind the queues, so it doesn't read as fan-out to consumers |
| competing-consumers | messaging | 6/6 | container | A: Competing Consumers | queue drawn as a `container` "Message Broker" |
| api-gateway-bff | api | 6/4 | person, aws-networking(api-gateway), container | A: API Gateway (+1 BFF) | mixes two patterns; one BFF isn't BFF |
| backend-for-frontend | api | 7/6 | person, container | A: BFF | ok topology, generic "Service A/B" |
| feature-flag-rollout | api | 5/3 | person, container, component | — | behavioral → Tier C |
| circuit-breaker | resilience | 5/3 | container, component | B (only via proxy/mesh) | breaker as a box between caller/provider → Tier C as drawn |
| bulkhead-isolation | resilience | 7/5 | person, component, container | A: Bulkhead | pools as `component`, no boundary |
| retry-with-fallback | resilience | 5/3 | container, component | C: Retry | behavioral |
| backpressure-buffer | resilience | 5/3 | container, component | A: Queue-Based Load Leveling | queue as `component` |
| blue-green-deployment | resilience | 5/3 | person, component, container | A: Deployment strategies | ok |
| canary-release | resilience | 6/4 | person, component, container | A: Deployment strategies | ok |
| shadow-deployment | resilience | 6/4 | person, component, container | — (traffic mirroring) | not in the reference list |
| active-passive-failover | resilience | 5/4 | person, component, container | A: Multi-region / DR | no region boundary |
| sharding-router | data | 6/4 | container, component | A: Sharding | ignores the existing `deploy-sharded-store/shard/shard-router` family |
| transactional-outbox | data | 6/4 | container, aws-database, component, aws-integration | A: Transactional Outbox | AWS-flavored (DynamoDB/SQS) |
| cqrs | data | 7/6 | person, container, aws-database, component | A: CQRS | AWS-flavored stores |
| cache-aside | data | 4/3 | container, aws-database | A: Cache-Aside | AWS-flavored (ElastiCache/RDS); two parallel app→cache edges |
| event-sourcing-cqrs | data | 7/5 | container | A: Event Sourcing | duplicate of `event-sourcing` |
| read-replica | data | 4/3 | container | A: Data Replication | single replica, DBs as `container` |
| database-per-service | data | 6/4 | container | microservices.io | Structura-specific, ok |
| multi-tier-cache | data | 5/5 | container | — | redundant with cache strategies |
| saga-choreography | event-driven | 6/6 | container, aws-integration(eventbridge) | A: Saga (choreography) | no compensation |
| saga-orchestration | event-driven | 7/5 | container | A: Saga (orchestration) | **no compensation edges** |
| event-sourcing | event-driven | 7/6 | person, container, aws-database, component | A: Event Sourcing | ok |
| event-carried-state-transfer | event-driven | 6/5 | container | ≈ Materialized View | overlaps Pub/Sub + Materialized View |
| policy-enforcement-point-opa | security | 7/6 | person, container | Structura-specific | ok |
| rbac-with-opa | security | 6/6 | person, container | Structura-specific | same shape as PEP |

## 3. Gap matrix

**Current → action**

| Action | Patterns |
| --- | --- |
| keep (rewrite to roles + i18n) | dead-letter-queue-aws→`dead-letter-queue`, fan-out, competing-consumers, backend-for-frontend, bulkhead-isolation, blue-green-deployment, canary-release, sharding-router→`sharding`, transactional-outbox, cqrs, cache-aside, saga-choreography, saga-orchestration (+compensation), event-sourcing, database-per-service, policy-enforcement-point-opa |
| rewrite into another reference pattern | api-gateway-bff → `api-gateway` (routing); read-replica → `data-replication`; active-passive-failover → `multi-region-active-passive` |
| merge into X | backpressure-buffer → queue-based-load-leveling; event-sourcing-cqrs → event-sourcing; event-carried-state-transfer → materialized-view; rbac-with-opa → policy-enforcement-point; multi-tier-cache → cache-write-through/behind (the note mentions L1/L2); shadow-deployment → canary-release (mentioned as a variant in the description) |
| remove (Tier C) | fifo-queue-aws, fifo-queue-kafka, feature-flag-rollout, circuit-breaker (as drawn), retry-with-fallback |

**Reference → state**

| Tier A | State | Tier A | State |
| --- | --- | --- | --- |
| API Gateway / Gateway Routing | exists-rewrite (from api-gateway-bff) | Strangler Fig | missing |
| Backends for Frontends | exists-ok (relabel) | Anti-Corruption Layer | missing |
| Gateway Aggregation | missing | Sidecar | missing |
| Publisher-Subscriber | missing | Ambassador | missing |
| Fan-out | exists-rewrite | Static Content Hosting | missing |
| Queue-Based Load Leveling | merge (backpressure-buffer) | Valet Key | missing |
| Competing Consumers | exists-rewrite | Claim Check | missing |
| Async Request-Reply | missing | Pipes and Filters | missing |
| CQRS | exists-ok | Scatter-Gather | missing |
| Event Sourcing | exists-ok (+merge dup) | Materialized View | merge (ECST) |
| Transactional Outbox | exists-rewrite | Federated Identity | missing |
| Saga — Orchestration | exists-rewrite (+compensation) | Hexagonal | missing |
| Saga — Choreography | exists-rewrite | Serverless API | missing |
| Cache-Aside | exists-rewrite | Load Balancer / Reverse Proxy | missing |
| Service Mesh | missing | Sharding | exists-rewrite |
| Data Replication | exists-rewrite (read-replica) | Bulkhead | exists-rewrite |
| Cell-Based | missing | Deployment strategies | exists-ok (blue-green, canary) |
| Multi-region / DR | exists-rewrite (active-passive) | Cache strategies | missing (write-through/behind) |

| Tier B | Proposal |
| --- | --- |
| Deployment Stamps | **merge** into Cell-Based: same drawing (router → N stamps, full stack each) |
| Geode | **merge** into Multi-region active-active (global router → regions, each serving + replicated data) |
| Scale Cube X/Y/Z | **exclude**: X = Load Balancer, Y = microservice split (Gateway Routing), Z = Sharding. No new fragment |
| Observability pipeline | **include**: services → collector → metrics/logs/traces backends, distinct shape |
| Priority Queue | exclude for now (two queues + pools; weak beside Competing Consumers) |
| Gatekeeper, Messaging Bridge, External Config Store | exclude (target size; candidates for a later round) |
| Circuit Breaker | covered by the Service Mesh fragment (a breaker on the sidecar proxy); no own entry |

## 4. Provider strategy (neutral + provider flavor, decided)

**Principle.** A pattern is authored once in **roles**. Application services the user writes ("Order Service") stay C4 `container` in every flavor. Only **infrastructure roles** resolve to a provider service.

**Role → service per family** (registry ids as they exist today; `category/service`):

| Role | AWS | GCP | Azure | Neutral |
| --- | --- | --- | --- | --- |
| queue | aws-integration/sqs | **gap** | azure-integration/servicebus | container + technology |
| topic (pub/sub) | aws-integration/sns | **gap** | azure-integration/servicebus | container |
| event-bus | aws-integration/eventbridge | **gap** | azure-integration/eventgrid | container |
| stream (log) | aws-analytics/kinesis | **gap** | azure-integration/eventhubs | container |
| broker (generic) | aws-integration/mq | **gap** | azure-integration/servicebus | container |
| cache | aws-database/elasticache | **gap** | azure-database/rediscache | container |
| relational-db | aws-database/rds | gcp-database/cloudsql | azure-database/sqldatabase | container |
| nosql-db | aws-database/dynamodb | **gap** | azure-database/cosmosdb | container |
| warehouse | aws-database/redshift | gcp-database/bigquery | azure-database/datawarehouse | container |
| object-storage | aws-storage/s3 | gcp-storage/cloud-storage | azure-storage/storageblob | container |
| cdn | aws-networking/cloudfront | **gap** | azure-networking/cdn | container |
| api-gateway | aws-networking/api-gateway | gcp-devtools/apigee | azure-integration/apimanagement | container |
| load-balancer | aws-networking/elb | **gap** | azure-networking/loadbalancer | container |
| global-router (DNS) | aws-networking/route53 | **gap** | azure-networking/trafficmanager | container |
| function | aws-compute/lambda | gcp-compute/cloudrun ¹ | azure-compute/functions | container |
| workflow | aws-integration/step-functions | **gap** | azure-integration/logicapps | container |
| identity-provider | aws-security/cognito | **gap** ² | azure-security/activedirectory | system (external) |
| secrets/config | aws-security/secrets-manager | **gap** | azure-security/keyvault | container |
| observability | aws-management/cloudwatch | gcp-analytics/observability | azure-devtools/appinsights | container |

¹ Cloud Run is serverless *containers*, not functions. It is the closest real id; open question Q4.
² `gcp-security/securityidentity` exists, but it is an umbrella icon ("Security & Identity"). The same goes for `gcp-networking/networking` (LB/CDN/DNS) and `gcp-integration/integrationservices` (Pub/Sub, Workflows). I've treated umbrellas as **gaps**, not matches (Q4).

**GCP is mostly gaps**: its catalog has ~40 entries, mostly product umbrellas, with no Pub/Sub, Memorystore, Firestore/Bigtable, Cloud CDN, Cloud Load Balancing, Cloud Functions or Workflows. A GCP-flavored queue pattern will mostly be neutral. Fixing that means adding GCP services to the catalog, which is out of scope.

**Fallback rule.** If a family has no service for a role, the node becomes the role's neutral element. Never an invented id. A test enumerates pattern × provider and asserts that every fallback is one of the gaps declared above.

**Where the vocabulary and mapping live — proposal:**

- **Roles = catalog concepts.** `feat/element-catalog-toolbar` introduces `CATALOG_CONCEPTS` (`features/elements/search/concepts.ts`). Each cloud service declares `concepts` (`sqs: ["queue"]`, `elasticache: ["cache"]`…), and the terms live in i18n.
- The pattern role vocabulary is that list, extended with `topic`, `event-bus`, `stream`, `broker`, `relational-db`, `nosql-db`, `warehouse`, `workflow`, `global-router`. Those split today's coarse `queue`/`events`/`database`.
- The role → service table is **derived**: for family F and role R, take the service in F whose `concepts` contains R, with a `primary` marker where a family has two (Azure `servicebus` vs `storagequeue`). No parallel list.
- The resolver is a pure function in `features/elements` (React-free, next to the registry). `@/features/diagram` doesn't need to know about providers.
- This requires the catalog branch to land first (Q1).

**UI.**

- A segmented control **Neutral · AWS · GCP · Azure** at the top of the pattern browser (the Patterns chip on the catalog branch, or `PatternPicker` on `main`).
- The last choice is kept in `canvas-preferences` (a UI preference, not diagram data).
- The provider family is chosen per insert, not per diagram.
- `insert_pattern` gains an optional `provider` param (`"neutral" | registered catalog family id`), validated against `allCloudFamilies()`.

## 5. Positioning

**Measured: every pattern inserted on an empty canvas.**

- **30/30 patterns overlap their own note.** The note is 336×475 (`NOTE_DEFAULT_W/H`), placed at `(0, -220)`, so it covers row 0 at x 0–336.
- **10/30 also overlap node on node**: api-gateway-bff, backend-for-frontend, circuit-breaker, bulkhead-isolation, backpressure-buffer, blue-green-deployment, shadow-deployment, sharding-router, saga-orchestration, event-carried-state-transfer.
  - The cause: authored spacing is `COL = 240` / `ROW = 160`, but cards render 200–260 wide (`CARD_MIN_W/MAX_W`) and grow in height with a description.
  - Caveat: the run matched picker cards by visible text, so `backend-for-frontend` may have measured `api-gateway-bff` (6 nodes measured vs 7 authored).

Other placement problems:

- **No avoidance of existing nodes**: the UI inserts at viewport center, the LLM at a fixed (300, 300).
- **No sizes written**, so a note or panel in a pattern paints at its render default, not at its registry size.

**Minimal fix (no layout engine touched):**

1. Author nodes on a grid cell (`col`, `row`), not in pixels. `insertPattern` maps a cell to px with a cell size ≥ the largest card plus a gutter (e.g. 300×200), from `layout.constants`.
2. Build nodes through `buildComponentForType` + `buildLayoutForComponent`, the path `addComponent` uses. That gives the descriptor's `createComponent` and `defaultSize` and removes the `as Component` cast.
3. **Drop the note from the fragment.** The "problem / how / when" text moves to the pattern's i18n description, shown in the browser card and preview, with the reference link. Inserting gives a clean fragment (Q3).
4. Free origin: a pure helper in `diagram/utils` computes the fragment's bounding box at the requested origin. If it intersects any existing top-level node layout, the helper shifts the origin right of the occupied bounding box. Used by `insertPattern`, so the UI and the LLM both benefit.
5. A new `parent` (by node key) on pattern nodes, so Sidecar (pod), Cell-Based (cells), Multi-region (regions), Service Mesh and Bulkhead can draw boundaries. Children are positioned relative to the parent, as `UserTemplate.parentIndex` already does.

Items 1, 2 and 4 change `patterns.slice.ts` only. The edge style / sides come from the existing `buildConnection` helper on the catalog branch, or are left unset.

## 6. Data shape

```ts
interface PatternNode {
  key: string;                    // stable, also the i18n key segment
  role?: PatternRole;             // infrastructure role → resolved per provider
  type?: ComponentType;           // explicit element (person, container, deploy-shard, k8s-container…)
  createOptions?: ElementCreateOptions; // panelKind for boundaries, podRole for sidecars, flowShape…
  parent?: string;                // key of the containing node
  col: number; row: number;       // grid cell, relative to the parent when nested
}
interface PatternEdge { from: string; to: string; label: string /* i18n key segment */ }
interface PatternTemplate {
  id: string;
  category: PatternCategory;
  nodes: PatternNode[];
  edges: PatternEdge[];
  references?: { en: string; "pt-BR"?: string }; // per-locale link
}
```

- **i18n**: `patterns.items.<id>.{name, description, nodes.<key>.{name, description}, edges.<label>}`. Every key exists in both locales, enforced by a test. Category labels: `patterns.category.<id>`.
- **Per-locale references**: the shape allows it. pt-BR → the Fidelis chapter when one exists, en → Azure/AWS/microservices.io.
- **Categories (8)**: `integration-messaging`, `api-edge`, `data-consistency`, `resilience`, `migration-modernization`, `deployment-scale`, `security-identity`, `structure`. `PATTERNS_BY_CATEGORY` is derived from `PATTERN_CATEGORIES`, not hand-listed.
- **Persistence**: confirmed that patterns are a code catalog. `insertPattern` copies them into ordinary components and connections, nothing references a pattern id afterwards, and no migration is needed.
  - Saved `UserTemplate`s use their own shape and are unaffected.
  - The LLM suggestion history may hold old `patternId`s (`SuggestionCard` renders them). An unknown id already falls through `isValidPatternId` / `PATTERNS.find` → warning, no crash.

## 7. Tests

- **Existing:**
  - `diagram/store/slices/patterns.slice.test.ts`: ids returned, components and connections written, no active diagram.
  - `llm/add-node-validation.test.ts`: mocks `insertPattern`.
  - Nothing tests catalog integrity, i18n coverage, overlaps or the LLM tool list.
- **To add:**
  - Catalog integrity: unique ids, unique node keys, every edge endpoint exists, every `type` is registered, every role is a known role.
  - i18n: every derived key exists in en and pt-BR.
  - Tier C guard: a deny-list of ids that must not reappear.
  - Resolver: pattern × {neutral, aws, gcp, azure}, where every resolved type is registered and every fallback is a declared gap.
  - Layout: no two nodes of a fragment intersect at their default sizes on the grid.
  - Insert: one checkpoint, one undo removes everything, a fragment beside existing nodes doesn't intersect them.
  - LLM: `list_patterns` returns the catalog, or is removed.

## 8. Coverage check against three cases (Fidelis repo)

Network access worked: the GitHub API and the site were both reachable. The site's chapter list confirmed which patterns have a pt-BR chapter.

| Case | Composed from the proposed catalog | Missing / not a fragment |
| --- | --- | --- |
| Encurtador de Links (`cases/BASICO_ENCURTADOR_DE_LINKS.md`): gateway, shortener service, relational DB, click event queue + worker, metrics store, optional cache | API Gateway, Cache-Aside, Queue-Based Load Leveling | rate limiting by API key (Tier C, annotation) |
| Checkout SAGA (`cases/INTERMEDIARIO_SAGA.md`): orchestrator, saga state store, inventory/payment/shipping, outbox, event bus, DLQ, compensation | Saga — Orchestration (with compensation + state store), Transactional Outbox, Dead Letter Queue | idempotency key, retries with backoff, timeouts (Tier C) |
| Telemetria Logística (`cases/AVANCADO_TELEMETRIA_LOGISTICA.md`): ingestion gateway, queue, hot store (geo), cold store, matcher, real-time channel | Pipes and Filters / Queue-Based Load Leveling, Materialized View (hot) | **hot/cold path split** and a **real-time push channel** have no fragment. Candidate: "Hot/Cold path (Lambda-style)" for a later round |

Fidelis chapters available as pt-BR references: Caching, Load Balancers e Proxies Reversos, API Gateways, BFFs, Service Mesh, Mensageria/Eventos/Streaming, Scale Cube, Sharding, Replicação, CQRS, Saga, Event Sourcing, Resiliência, Observabilidade, Bulkhead, Cell-Based, Estratégias de Deploy, Single Point of Failure. The course repo has runnable examples for api-gateway, cache, cqrs, deployment-methods, load-balancing, partitioning, saga and sharding.

---

## Final proposed list (42)

| Category | Patterns |
| --- | --- |
| Integration & Messaging (9) | publisher-subscriber, fan-out, queue-based-load-leveling, competing-consumers, async-request-reply, claim-check, pipes-and-filters, scatter-gather, dead-letter-queue |
| API & Edge (5) | api-gateway, backends-for-frontends, gateway-aggregation, static-content-hosting, load-balancer-reverse-proxy |
| Data & Consistency (11) | cqrs, event-sourcing, transactional-outbox, saga-orchestration, saga-choreography, cache-aside, cache-write-through-behind, materialized-view, data-replication, sharding, database-per-service |
| Resilience (3) | bulkhead, multi-region-active-passive (backup/pilot-light/warm-standby in the description), multi-region-active-active (absorbs Geode) |
| Migration & Modernization (2) | strangler-fig, anti-corruption-layer |
| Deployment & Scale (3) | blue-green-deployment, canary-release (absorbs shadow), cell-based (absorbs Deployment Stamps) |
| Security & Identity (3) | federated-identity, valet-key, policy-enforcement-point (absorbs rbac-with-opa) |
| Structure (6) | sidecar, ambassador, service-mesh, hexagonal, serverless-api, observability-pipeline |

That is two above the 35–40 target. The cut candidates are `database-per-service` (not in the reference list) and `dead-letter-queue` (EIP, not Azure/AWS).

**Before → after**: 30 → 42. 16 kept and rewritten, 3 rewritten into another reference pattern, 6 merged, 5 removed, 23 new.

## Slice plan

- **P1 — data model + i18n + placement.**
  - New shape (keys, grid cells, `parent`) and the 8 categories.
  - Existing content moves to `patterns.items.*` in en + pt-BR, the note becomes the description, and `references` is added.
  - `insertPattern` builds through `buildComponentForType`/`buildLayoutForComponent` and gets the free-origin helper.
  - Pin test: same node types and edges per existing pattern (strings aside).
- **P2 — curate existing**, one commit per category (rewrite / merge / remove per §3), authored in roles.
- **P3 — add the 23 missing**, one commit per category.
- **P4 — provider flavor.**
  - Extend concepts into roles and add `primary` where needed.
  - Pure resolver, provider selector in the pattern browser (with the preference), `insert_pattern.provider`.
- **P5 — LLM sync.**
  - `buildPatternCatalogCompact` with categories + roles.
  - Implement `list_patterns` (read tool returning id, name, category, roles), or remove it from `tools.ts`.

## Risks

- **Catalog branch dependency**: roles reuse its concepts, and the picker UI lives in its `PatternBrowser`. Building on `main` means building UI inside a file the other branch deletes.
- **GCP flavor is mostly neutral** until the GCP catalog gains real services. Users may read "GCP" as broken.
- **Changing `insertPattern`'s construction path** affects `UserTemplate` only if I touch its branch. I will keep that branch as is.
- **`parent` boundaries**: panels need sizes that fit their children. With grid cells the parent size is computable (cells × cell size + padding) without a layout engine.
- **Dropping the note** removes the in-canvas explanation people may rely on. Mitigated by the description and preview in the browser (Q3).
- **pt-BR terminology**: some reference names have no settled pt-BR form (Valet Key, Claim Check). I'd keep the English name with a pt-BR description, following Fidelis where he does the same (CQRS, Saga, Bulkhead).

## Open questions

- **Q1 — Base branch.** Merge `feat/element-catalog-toolbar` first and rebase this work on it (recommended: roles reuse its concepts, the provider selector goes in its `PatternBrowser`)? Or build on `main` against `PatternPicker` and reconcile later?
- **Q2 — Roles = catalog concepts.** Extend `CATALOG_CONCEPTS` as the role vocabulary and derive the provider table from `CloudFamilyService.concepts` (recommended)? Or keep a separate pattern-role list?
- **Q3 — Note node.** Drop the in-canvas note from fragments and move its text to the description/preview (recommended)? Or keep it, placed beside the fragment?
- **Q4 — Approximate and umbrella mappings.** Accept `cloudrun` for GCP `function` and treat umbrella ids (`networking`, `securityidentity`, `integrationservices`) as gaps (recommended)? Or allow umbrellas as matches?
- **Q5 — Size.** Ship 42, or cut `database-per-service` and `dead-letter-queue` to land at 40?
- **Q6 — `list_patterns`.** Implement it as a read tool (recommended), or remove it?

## Decisions (owner, after the audit)

- Q1: the work is based on `feat/element-catalog-toolbar` (branch `feat/pattern-catalog-refresh`).
- Q2: roles are catalog concepts, extended; the provider table is derived from `CloudFamilyService.concepts`.
- Q3: the note leaves the fragment; its text becomes the pattern description.
- Q4: GCP `function` → `cloudrun`; umbrella ids are gaps.
- Q5: 40 patterns — `database-per-service` and `dead-letter-queue` are cut.
- Q6: `list_patterns` is implemented as a read tool.

## Outcome (build)

| Category | Before (old categories) | After |
| --- | --- | --- |
| Integration & Messaging | messaging 5 | 8 |
| API & Edge | api 3 | 5 |
| Data & Consistency | data 8 + event-driven 4 | 10 |
| Resilience | resilience 8 | 3 |
| Migration & Modernization | — | 2 |
| Deployment & Scale | — (in resilience) | 3 |
| Security & Identity | security 2 | 3 |
| Structure | — | 6 |
| **Total** | **30** | **40** |

Removed (Tier C, behavioral): fifo-queue-aws, fifo-queue-kafka, feature-flag-rollout,
circuit-breaker, retry-with-fallback. Cut by size (Q5): database-per-service, dead-letter-queue.
Merged: backpressure-buffer → queue-based-load-leveling, event-sourcing-cqrs → event-sourcing,
event-carried-state-transfer → materialized-view, multi-tier-cache → cache-write-through-behind,
shadow-deployment → canary-release, rbac-with-opa → policy-enforcement-point.

Deviations from the plan:

- **No P1 pin test.** Every kept pattern was rewritten in roles, so "same nodes as before" could
  not hold. P1 shipped the new model with the first category instead, and the integrity test
  (ids, keys, edges, registered types, i18n in both locales, Tier C deny-list, provider × role
  fallbacks only on declared gaps, no overlaps on the grid) replaced it.
- **Fewer commits than categories.** Categories whose i18n landed together share a commit.
- **Boundaries are panels.** Pod, cell, region and pool are default panels, not the typed
  containers of the deploy/k8s families (`deploy-sharded-store`, `k8s-workload`). Those size
  themselves from their children, which the grid sizing can't predict.
- **Providers are derived.** The list is Neutral + every family that resolves at least one role,
  so **Open source** (Kafka, Redis) appears beside AWS / GCP / Azure.

Browser check (Vite + one Playwright instance): each of the 40 patterns was inserted beside an
existing node. Result: 0 overlapping nodes, and one undo restored the canvas every time, in
pt-BR and en. AWS, GCP and Azure resolved the expected number of service cards. GCP falls back
to neutral on its declared gaps.
