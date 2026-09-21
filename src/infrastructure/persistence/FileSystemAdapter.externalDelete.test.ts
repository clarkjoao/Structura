import { describe, expect, it } from "vitest";
import type { Diagram } from "@/features/diagram";
import { FileSystemAdapter } from "./FileSystemAdapter";
import { createMemoryFs } from "./__testing__/memoryFileSystem";

/**
 * What the workspace reports after someone deletes a diagram file by hand.
 *
 * Pinned because the answer was not obvious from reading the code, and getting
 * it wrong in either direction is expensive: believing deletions are noticed
 * when they are not leaves the two sides silently diverging, and "fixing" a
 * non-problem by deleting from the store on a missed read destroys work.
 *
 * The boundary these tests draw:
 *  - `loadWorkspace` reads the directory, so a deleted file is absent from
 *    what a reconnect hydrates with. `doReconnect` replaces the store's
 *    diagrams wholesale from this, so the deletion lands.
 *  - The steady-state flush never re-reads the directory; it diffs the store
 *    against what it last wrote. An external deletion is invisible to it, and
 *    editing that diagram afterwards writes the file back.
 */

type AdapterInternals = { handle: FileSystemDirectoryHandle | null };

function connect() {
  const fs = createMemoryFs();
  const adapter = new FileSystemAdapter();
  (adapter as unknown as AdapterInternals).handle = fs.rootHandle;
  return { adapter, fs };
}

function diagram(id: string, name = id): Diagram {
  return {
    id,
    name,
    level: "context",
    createdAt: 1,
    updatedAt: 2,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  } as Diagram;
}

async function writeManifestFor(adapter: FileSystemAdapter, ids: string[]) {
  await adapter.writeManifest({
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    diagramIds: ids,
    activeDiagramId: ids[0] ?? null,
    folders: {},
  } as never);
}

describe("a diagram file deleted outside the application", () => {
  it("is absent from what a reconnect loads", async () => {
    const { adapter, fs } = connect();
    await adapter.writeDiagram(diagram("d-1"));
    await adapter.writeDiagram(diagram("d-2"));
    await writeManifestFor(adapter, ["d-1", "d-2"]);

    fs.removeAtRoot("d-1.json");
    const workspace = await adapter.loadWorkspace();

    // doReconnect assigns these over the store's diagrams, so the deletion
    // reaches the library rather than being undone.
    expect(Object.keys(workspace?.diagrams ?? {})).toEqual(["d-2"]);
  });

  it("leaves the manifest still naming it, which is how the divergence is visible", async () => {
    const { adapter, fs } = connect();
    await adapter.writeDiagram(diagram("d-1"));
    await writeManifestFor(adapter, ["d-1"]);

    fs.removeAtRoot("d-1.json");
    const manifest = await adapter.readManifest();

    // The manifest is a per-workspace record of what was last written here.
    // Nothing reconciles it against the directory today; it is the material a
    // "this file was deleted outside the app" check would be built from.
    expect(manifest?.diagramIds).toEqual(["d-1"]);
  });

  it("comes back if the diagram is written again", async () => {
    const { adapter, fs } = connect();
    await adapter.writeDiagram(diagram("d-1"));
    fs.removeAtRoot("d-1.json");

    // The steady-state flush writes whatever changed in the store without
    // consulting the directory, so an edit after an external delete restores
    // the file. This is the narrow case where a deletion is undone.
    await adapter.writeDiagram({ ...diagram("d-1"), name: "renamed" });

    expect(fs.hasFile("d-1.json")).toBe(true);
  });

  it("does not take the rest of the workspace with it", async () => {
    const { adapter, fs } = connect();
    await adapter.writeDiagram(diagram("d-1"));
    await adapter.writeDiagram(diagram("d-2"));
    await writeManifestFor(adapter, ["d-1", "d-2"]);

    fs.removeAtRoot("d-1.json");
    const scan = await adapter.scanWorkspace();

    expect(scan.valid.map((d) => d.id)).toEqual(["d-2"]);
    expect(scan.invalid).toEqual([]);
  });
});
