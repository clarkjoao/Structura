import {
  COLLECTIONS,
  type CollectionName,
  type DiagramPatch,
  type DiagramState,
  type DocField,
  type EntityMap,
} from "../../protocol.js";

/**
 * Patch → expected-state cases every `RoomStore` must reproduce exactly. They pin down the merge
 * rules: field-level last-writer-wins, remove-wins over a stale edit, soft-lock guarding, and
 * "a change that changes nothing takes no version".
 */

export interface MergeStep {
  sender: string;
  /** Defaults to the room version at the time of the step (a fully up-to-date sender). */
  senderVersion?: number;
  patch: DiagramPatch;
  expect: "applied" | "noop";
  effective?: DiagramPatch;
}

export interface MergeFixture {
  name: string;
  seed: DiagramState;
  locks?: Array<{ entityId: string; holder: string }>;
  steps: MergeStep[];
  finalVersion: number;
  finalState: DiagramState;
}

export function makeState(
  entities: Partial<Record<CollectionName, EntityMap>> = {},
  doc: Partial<Record<DocField, unknown>> = {},
): DiagramState {
  const all = {} as Record<CollectionName, EntityMap>;
  for (const collection of COLLECTIONS) all[collection] = entities[collection] ?? {};
  return { doc, entities: all };
}

const DOC = { diagramId: "d1", diagramName: "Payments", level: "context" };
const C1 = { id: "c1", name: "API", description: "Edge API", type: "system", parentId: null };
const C2 = { id: "c2", name: "DB", description: "", type: "database", parentId: null };
const L1 = { elementId: "c1", x: 10, y: 20, width: 180, height: 90 };
const L2 = { elementId: "c2", x: 300, y: 20, width: 180, height: 90 };
const K1 = { id: "k1", sourceId: "c1", targetId: "c2", label: "reads" };

const base = () =>
  makeState(
    { components: { c1: { ...C1 }, c2: { ...C2 } }, nodeLayouts: { c1: { ...L1 }, c2: { ...L2 } } },
    { ...DOC },
  );
const withConn = () => {
  const s = base();
  s.entities.connections = { k1: { ...K1 } };
  return s;
};

export const MERGE_FIXTURES: MergeFixture[] = [
  // ── Doc fields ──
  {
    name: "rename the diagram",
    seed: base(),
    steps: [{ sender: "a", patch: { doc: { diagramName: "Billing" } }, expect: "applied" }],
    finalVersion: 1,
    finalState: makeState(base().entities, { ...DOC, diagramName: "Billing" }),
  },
  {
    name: "renaming to the same name takes no version",
    seed: base(),
    steps: [{ sender: "a", patch: { doc: { diagramName: "Payments" } }, expect: "noop" }],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "diagramId cannot be changed",
    seed: base(),
    steps: [{ sender: "a", patch: { doc: { diagramId: "other" } }, expect: "noop" }],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "doc field set to null keeps null",
    seed: base(),
    steps: [{ sender: "a", patch: { doc: { activeVersionId: null } }, expect: "applied" }],
    finalVersion: 1,
    finalState: makeState(base().entities, { ...DOC, activeVersionId: null }),
  },
  {
    name: "several doc fields in one patch take one version",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { doc: { diagramName: "X", domain: "fin", description: "d" } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: makeState(base().entities, {
      ...DOC,
      diagramName: "X",
      domain: "fin",
      description: "d",
    }),
  },
  {
    name: "unchanged doc field is left out of the effective patch",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { doc: { diagramName: "Payments", domain: "fin" } },
        expect: "applied",
        effective: { doc: { domain: "fin" } },
      },
    ],
    finalVersion: 1,
    finalState: makeState(base().entities, { ...DOC, domain: "fin" }),
  },
  // ── Creation, one per collection ──
  ...(
    [
      ["components", { id: "c3", name: "Queue" }],
      ["connections", { id: "c3", sourceId: "c1", targetId: "c2" }],
      ["flows", { id: "c3", name: "Checkout", steps: [] }],
      ["iconLibrary", { id: "c3", svg: "<svg/>" }],
      ["nodeLayouts", { elementId: "c3", x: 1, y: 2 }],
      ["edgeLayouts", { id: "c3", waypoints: [{ x: 1, y: 1 }] }],
      ["versions", { id: "c3", name: "v2", addedComponents: {} }],
    ] as Array<[CollectionName, Record<string, unknown>]>
  ).map(([collection, entity]): MergeFixture => {
    const expected = base();
    expected.entities[collection] = { ...expected.entities[collection], c3: entity };
    return {
      name: `create an entity in ${collection}`,
      seed: base(),
      steps: [
        {
          sender: "a",
          patch: { entities: { [collection]: { c3: { set: entity } } } },
          expect: "applied",
        },
      ],
      finalVersion: 1,
      finalState: expected,
    };
  }),
  {
    name: "an empty set creates nothing",
    seed: base(),
    steps: [
      { sender: "a", patch: { entities: { components: { c9: { set: {} } } } }, expect: "noop" },
    ],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "removing fields of a missing entity creates nothing",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c9: { unset: ["name"] } } } },
        expect: "noop",
      },
    ],
    finalVersion: 0,
    finalState: base(),
  },
  // ── Field merge ──
  {
    name: "setting one field keeps the others",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: { set: { name: "Gateway" } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.components.c1 = { ...C1, name: "Gateway" };
      return s;
    })(),
  },
  {
    name: "concurrent edits to different fields both survive",
    seed: base(),
    steps: [
      {
        sender: "a",
        senderVersion: 0,
        patch: { entities: { components: { c1: { set: { name: "Gateway" } } } } },
        expect: "applied",
      },
      {
        sender: "b",
        senderVersion: 0,
        patch: { entities: { components: { c1: { set: { description: "Public" } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 2,
    finalState: (() => {
      const s = base();
      s.entities.components.c1 = { ...C1, name: "Gateway", description: "Public" };
      return s;
    })(),
  },
  {
    name: "concurrent edits to the same field: the later one wins",
    seed: base(),
    steps: [
      {
        sender: "a",
        senderVersion: 0,
        patch: { entities: { nodeLayouts: { c1: { set: { x: 100 } } } } },
        expect: "applied",
      },
      {
        sender: "b",
        senderVersion: 0,
        patch: { entities: { nodeLayouts: { c1: { set: { x: 200 } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 2,
    finalState: (() => {
      const s = base();
      s.entities.nodeLayouts.c1 = { ...L1, x: 200 };
      return s;
    })(),
  },
  {
    name: "setting a field to its current value takes no version",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { nodeLayouts: { c1: { set: { x: 10 } } } } },
        expect: "noop",
      },
    ],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "only the fields that changed are in the effective patch",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { nodeLayouts: { c1: { set: { x: 10, y: 99 } } } } },
        expect: "applied",
        effective: { entities: { nodeLayouts: { c1: { set: { y: 99 } } } } },
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.nodeLayouts.c1 = { ...L1, y: 99 };
      return s;
    })(),
  },
  {
    name: "a field set to null keeps null",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: { set: { description: null } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.components.c1 = { ...C1, description: null };
      return s;
    })(),
  },
  {
    name: "parentId null stays distinguishable from absent",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: { set: { parentId: null } } } } },
        expect: "noop",
      },
    ],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "unset removes a field",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: { unset: ["description"] } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      const { description: _d, ...rest } = C1;
      s.entities.components.c1 = rest;
      return s;
    })(),
  },
  {
    name: "unset of a missing field takes no version",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: { unset: ["technology"] } } } },
        expect: "noop",
      },
    ],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "nested object values are replaced whole",
    seed: makeState({ components: { c1: { id: "c1", meta: { a: 1, b: 2 } } } }),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: { set: { meta: { a: 5 } } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: makeState({ components: { c1: { id: "c1", meta: { a: 5 } } } }),
  },
  {
    name: "array values are replaced whole",
    seed: makeState({ flows: { f1: { id: "f1", steps: ["a", "b"] } } }),
    steps: [
      {
        sender: "a",
        patch: { entities: { flows: { f1: { set: { steps: ["b"] } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: makeState({ flows: { f1: { id: "f1", steps: ["b"] } } }),
  },
  {
    name: "set and unset in one entity patch",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: {
          entities: { components: { c1: { set: { name: "Edge" }, unset: ["description"] } } },
        },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      const { description: _d, ...rest } = C1;
      s.entities.components.c1 = { ...rest, name: "Edge" };
      return s;
    })(),
  },
  {
    name: "one patch across collections takes one version",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: {
          entities: {
            components: { c3: { set: { id: "c3", name: "Cache" } } },
            nodeLayouts: { c3: { set: { elementId: "c3", x: 5, y: 5 } } },
          },
        },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.components.c3 = { id: "c3", name: "Cache" };
      s.entities.nodeLayouts.c3 = { elementId: "c3", x: 5, y: 5 };
      return s;
    })(),
  },
  {
    name: "a no-op does not consume a version between two edits",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { nodeLayouts: { c1: { set: { x: 11 } } } } },
        expect: "applied",
      },
      {
        sender: "a",
        patch: { entities: { nodeLayouts: { c1: { set: { x: 11 } } } } },
        expect: "noop",
      },
      {
        sender: "a",
        patch: { entities: { nodeLayouts: { c1: { set: { x: 12 } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 2,
    finalState: (() => {
      const s = base();
      s.entities.nodeLayouts.c1 = { ...L1, x: 12 };
      return s;
    })(),
  },
  // ── Removal ──
  {
    name: "remove an entity",
    seed: base(),
    steps: [{ sender: "a", patch: { entities: { components: { c2: null } } }, expect: "applied" }],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      delete s.entities.components.c2;
      return s;
    })(),
  },
  {
    name: "removing a missing entity takes no version",
    seed: base(),
    steps: [{ sender: "a", patch: { entities: { components: { c9: null } } }, expect: "noop" }],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "a stale edit of a removed entity is dropped",
    seed: base(),
    steps: [
      {
        sender: "a",
        senderVersion: 0,
        patch: { entities: { nodeLayouts: { c2: null } } },
        expect: "applied",
      },
      {
        sender: "b",
        senderVersion: 0,
        patch: { entities: { nodeLayouts: { c2: { set: { x: 1 } } } } },
        expect: "noop",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      delete s.entities.nodeLayouts.c2;
      return s;
    })(),
  },
  {
    name: "a stale field removal on a removed entity is dropped",
    seed: base(),
    steps: [
      {
        sender: "a",
        senderVersion: 0,
        patch: { entities: { components: { c2: null } } },
        expect: "applied",
      },
      {
        sender: "b",
        senderVersion: 0,
        patch: { entities: { components: { c2: { unset: ["name"] } } } },
        expect: "noop",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      delete s.entities.components.c2;
      return s;
    })(),
  },
  {
    name: "an informed re-creation after removal is accepted",
    seed: base(),
    steps: [
      {
        sender: "a",
        senderVersion: 0,
        patch: { entities: { components: { c2: null } } },
        expect: "applied",
      },
      {
        sender: "b",
        senderVersion: 1,
        patch: { entities: { components: { c2: { set: { id: "c2", name: "DB2" } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 2,
    finalState: (() => {
      const s = base();
      s.entities.components.c2 = { id: "c2", name: "DB2" };
      return s;
    })(),
  },
  {
    name: "re-creation clears the removal, so a later stale edit of the old one applies",
    seed: base(),
    steps: [
      {
        sender: "a",
        senderVersion: 0,
        patch: { entities: { components: { c2: null } } },
        expect: "applied",
      },
      {
        sender: "a",
        senderVersion: 1,
        patch: { entities: { components: { c2: { set: { id: "c2" } } } } },
        expect: "applied",
      },
      {
        sender: "b",
        senderVersion: 0,
        patch: { entities: { components: { c2: { set: { name: "late" } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 3,
    finalState: (() => {
      const s = base();
      s.entities.components.c2 = { id: "c2", name: "late" };
      return s;
    })(),
  },
  {
    name: "removal in one collection does not affect the same id elsewhere",
    seed: base(),
    steps: [
      {
        sender: "a",
        senderVersion: 0,
        patch: { entities: { components: { c1: null } } },
        expect: "applied",
      },
      {
        sender: "b",
        senderVersion: 0,
        patch: { entities: { nodeLayouts: { c1: { set: { x: 50 } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 2,
    finalState: (() => {
      const s = base();
      delete s.entities.components.c1;
      s.entities.nodeLayouts.c1 = { ...L1, x: 50 };
      return s;
    })(),
  },
  {
    name: "removal of component and layout together",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: null }, nodeLayouts: { c1: null } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      delete s.entities.components.c1;
      delete s.entities.nodeLayouts.c1;
      return s;
    })(),
  },
  {
    name: "a stale drag after a delete leaves no orphan layout",
    seed: base(),
    steps: [
      {
        sender: "a",
        senderVersion: 0,
        patch: { entities: { components: { c1: null }, nodeLayouts: { c1: null } } },
        expect: "applied",
      },
      {
        sender: "b",
        senderVersion: 0,
        patch: { entities: { nodeLayouts: { c1: { set: { x: 77 } } } } },
        expect: "noop",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      delete s.entities.components.c1;
      delete s.entities.nodeLayouts.c1;
      return s;
    })(),
  },
  {
    name: "remove an entity and create another in one patch",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c2: null, c3: { set: { id: "c3" } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      delete s.entities.components.c2;
      s.entities.components.c3 = { id: "c3" };
      return s;
    })(),
  },
  // ── Soft locks ──
  {
    name: "the lock holder may move the node",
    seed: base(),
    locks: [{ entityId: "c1", holder: "a" }],
    steps: [
      {
        sender: "a",
        patch: { entities: { nodeLayouts: { c1: { set: { x: 5 } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.nodeLayouts.c1 = { ...L1, x: 5 };
      return s;
    })(),
  },
  {
    name: "another participant cannot move a locked node",
    seed: base(),
    locks: [{ entityId: "c1", holder: "a" }],
    steps: [
      {
        sender: "b",
        patch: { entities: { nodeLayouts: { c1: { set: { x: 5, y: 6 } } } } },
        expect: "noop",
      },
    ],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "unguarded fields of a locked entity still apply",
    seed: base(),
    locks: [{ entityId: "c1", holder: "a" }],
    steps: [
      {
        sender: "b",
        patch: { entities: { components: { c1: { set: { name: "Nope", type: "container" } } } } },
        expect: "applied",
        effective: { entities: { components: { c1: { set: { type: "container" } } } } },
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.components.c1 = { ...C1, type: "container" };
      return s;
    })(),
  },
  {
    name: "a guarded unset from a non-holder is dropped",
    seed: base(),
    locks: [{ entityId: "c1", holder: "a" }],
    steps: [
      {
        sender: "b",
        patch: { entities: { components: { c1: { unset: ["description"] } } } },
        expect: "noop",
      },
    ],
    finalVersion: 0,
    finalState: base(),
  },
  {
    name: "a connection label is guarded by its lock",
    seed: withConn(),
    locks: [{ entityId: "k1", holder: "a" }],
    steps: [
      {
        sender: "b",
        patch: { entities: { connections: { k1: { set: { label: "writes" } } } } },
        expect: "noop",
      },
      {
        sender: "a",
        patch: { entities: { connections: { k1: { set: { label: "writes" } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = withConn();
      s.entities.connections.k1 = { ...K1, label: "writes" };
      return s;
    })(),
  },
  {
    name: "a lock on one node does not guard another",
    seed: base(),
    locks: [{ entityId: "c1", holder: "a" }],
    steps: [
      {
        sender: "b",
        patch: { entities: { nodeLayouts: { c2: { set: { x: 1 } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.nodeLayouts.c2 = { ...L2, x: 1 };
      return s;
    })(),
  },
  {
    name: "a lock does not stop removal",
    seed: base(),
    locks: [{ entityId: "c1", holder: "a" }],
    steps: [{ sender: "b", patch: { entities: { nodeLayouts: { c1: null } } }, expect: "applied" }],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      delete s.entities.nodeLayouts.c1;
      return s;
    })(),
  },
  {
    name: "a non-holder's mixed patch keeps only what the lock allows",
    seed: base(),
    locks: [{ entityId: "c1", holder: "a" }],
    steps: [
      {
        sender: "b",
        patch: {
          doc: { diagramName: "Mixed" },
          entities: { nodeLayouts: { c1: { set: { x: 9 } }, c2: { set: { x: 9 } } } },
        },
        expect: "applied",
        effective: {
          doc: { diagramName: "Mixed" },
          entities: { nodeLayouts: { c2: { set: { x: 9 } } } },
        },
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.doc.diagramName = "Mixed";
      s.entities.nodeLayouts.c2 = { ...L2, x: 9 };
      return s;
    })(),
  },
  // ── Values ──
  {
    name: "unicode and HTML-ish text survive verbatim",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: { set: { description: "coração 🇧🇷 <b>&" } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.components.c1 = { ...C1, description: "coração 🇧🇷 <b>&" };
      return s;
    })(),
  },
  {
    name: "numbers keep their value",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { nodeLayouts: { c1: { set: { x: -2.5, y: 1e6 } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.nodeLayouts.c1 = { ...L1, x: -2.5, y: 1e6 };
      return s;
    })(),
  },
  {
    name: "booleans and empty strings are values, not removals",
    seed: base(),
    steps: [
      {
        sender: "a",
        patch: { entities: { components: { c1: { set: { hidden: false, description: "" } } } } },
        expect: "applied",
      },
    ],
    finalVersion: 1,
    finalState: (() => {
      const s = base();
      s.entities.components.c1 = { ...C1, hidden: false, description: "" };
      return s;
    })(),
  },
];
