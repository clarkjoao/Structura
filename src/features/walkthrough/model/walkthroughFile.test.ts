import { describe, expect, it } from "vitest";
import type { WalkthroughPresentation } from "./walkthrough.types";
import {
  WALKTHROUGH_FILE_KIND,
  WALKTHROUGH_SCHEMA_VERSION,
  fromWalkthroughFile,
  toWalkthroughFile,
} from "./walkthroughFile";

const FULL: WalkthroughPresentation = {
  id: "wt_1",
  title: "Checkout tour",
  description: "covers the checkout path",
  authorNotes: "mention the retry",
  folderId: "payments",
  steps: [
    { id: "st1", diagramId: "d-1", flowId: "f-1", label: "Start here", note: "slow down" },
    { id: "st2", diagramId: "d-2", flowId: "f-2" },
  ],
  createdAt: 111,
  updatedAt: 222,
};

describe("round trip", () => {
  it("loses nothing on the way to disk and back", () => {
    expect(fromWalkthroughFile(toWalkthroughFile(FULL))).toEqual(FULL);
  });

  it("survives being serialised as JSON, which is how it actually travels", () => {
    const onDisk = JSON.parse(JSON.stringify(toWalkthroughFile(FULL))) as unknown;

    expect(fromWalkthroughFile(onDisk)).toEqual(FULL);
  });

  it("names itself, so a renamed file is still recognisable", () => {
    const file = toWalkthroughFile(FULL);

    expect(file.kind).toBe(WALKTHROUGH_FILE_KIND);
    expect(file.schemaVersion).toBe(WALKTHROUGH_SCHEMA_VERSION);
  });

  it("carries a walkthrough with no folder as belonging to none", () => {
    const rootLevel = { ...FULL, folderId: null };

    expect(fromWalkthroughFile(toWalkthroughFile(rootLevel))?.folderId).toBeNull();
  });
});

describe("rejecting rather than throwing", () => {
  it.each([
    ["nothing", null],
    ["a string", "hello"],
    ["an array", []],
    ["an empty object", {}],
    ["another kind of file", { kind: "structura-diagram", schemaVersion: 1, walkthrough: {} }],
    ["no schema version", { kind: WALKTHROUGH_FILE_KIND, walkthrough: { id: "a", title: "t" } }],
    [
      "a version from a later app",
      {
        kind: WALKTHROUGH_FILE_KIND,
        schemaVersion: WALKTHROUGH_SCHEMA_VERSION + 1,
        walkthrough: { id: "a", title: "t", steps: [] },
      },
    ],
    [
      "no id",
      { kind: WALKTHROUGH_FILE_KIND, schemaVersion: 1, walkthrough: { title: "t", steps: [] } },
    ],
    [
      "an empty id",
      {
        kind: WALKTHROUGH_FILE_KIND,
        schemaVersion: 1,
        walkthrough: { id: "", title: "t", steps: [] },
      },
    ],
    [
      "steps that are not a list",
      {
        kind: WALKTHROUGH_FILE_KIND,
        schemaVersion: 1,
        walkthrough: { id: "a", title: "t", steps: "nope" },
      },
    ],
    [
      "a step missing its flow",
      {
        kind: WALKTHROUGH_FILE_KIND,
        schemaVersion: 1,
        walkthrough: { id: "a", title: "t", steps: [{ id: "st3", diagramId: "d-1" }] },
      },
    ],
    ["a deletion marker", { deleted: true }],
  ])("returns null for %s", (_label, raw) => {
    expect(() => fromWalkthroughFile(raw)).not.toThrow();
    expect(fromWalkthroughFile(raw)).toBeNull();
  });
});

describe("tolerating a thin file", () => {
  it("fills in the times a hand-written file left out", () => {
    const read = fromWalkthroughFile({
      kind: WALKTHROUGH_FILE_KIND,
      schemaVersion: 1,
      walkthrough: { id: "a", title: "t", steps: [] },
    });

    expect(read).toEqual({
      id: "a",
      title: "t",
      description: undefined,
      authorNotes: undefined,
      folderId: null,
      steps: [],
      createdAt: 0,
      updatedAt: 0,
    });
  });
});
