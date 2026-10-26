import { describe, expect, it } from "vitest";
import type { VersionDiff } from "@/features/diagram";
import { groupVersionsByStatus } from "./version-groups";

const v = (id: string, status?: VersionDiff["status"]): VersionDiff => ({
  id,
  name: id,
  color: "#000",
  createdAt: 0,
  addedComponents: {},
  addedConnections: {},
  removedComponentIds: [],
  removedConnectionIds: [],
  nodeLayouts: {},
  ...(status ? { status } : {}),
});

describe("groupVersionsByStatus", () => {
  it("orders groups by lifecycle, puts Versions without status last, and drops empty groups", () => {
    const groups = groupVersionsByStatus([
      v("a"),
      v("b", "in-progress"),
      v("c", "proposed"),
      v("d", "in-progress"),
    ]);
    expect(groups.map((g) => [g.status, g.versions.map((x) => x.id)])).toEqual([
      ["proposed", ["c"]],
      ["in-progress", ["b", "d"]],
      [null, ["a"]],
    ]);
  });
});
