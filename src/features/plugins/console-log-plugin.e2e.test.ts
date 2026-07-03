import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { useDiagramStore } from "@/features/diagram";
import {
  initializePluginRegistry,
  installPluginFromCode,
  resetPluginRegistryForTests,
  setPluginEnabled,
} from "./plugin-registry";

/**
 * End-to-end pass over the shipped console-log example plugin: install the real file,
 * verify committed changes produce console diffs, and that its Alt+Shift+O command
 * manipulates the current diagram through the v1.1 API with single-undo semantics.
 */

const PLUGIN_PATH = join(__dirname, "../../../examples/plugins/console-log-plugin.js");
const PLUGIN_ID = "structura-plugin-console-log";
const NOTIFIER_DEBOUNCE_MS = 300;

function pressArrangeShortcut(): void {
  document.dispatchEvent(
    new KeyboardEvent("keydown", { code: "KeyO", altKey: true, shiftKey: true, bubbles: true }),
  );
}

describe("console-log example plugin end-to-end", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ now: Date.now() + 1_000_000 });
    await initializePluginRegistry(new InMemoryAdapter());
  });

  afterEach(async () => {
    await resetPluginRegistryForTests();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("logs committed diffs and grid-arranges the current diagram with one undo step", async () => {
    const code = readFileSync(PLUGIN_PATH, "utf-8");
    const install = await installPluginFromCode(code);
    expect(install).toMatchObject({ ok: true, manifest: { id: PLUGIN_ID } });

    const store = useDiagramStore.getState();
    const diagram = store.addDiagram(`Logger E2E ${Math.random()}`, "context");
    store.openDiagram(diagram.id);
    const alpha = store.addComponent("system", "Alpha", null, { x: 500, y: 500 }).id;
    const beta = store.addComponent("system", "Beta", null, { x: 700, y: 900 }).id;

    // First committed batch: notifier debounce fires, plugin seeds/logs the snapshot.
    const logSpy = vi.spyOn(console, "log");
    const groupSpy = vi.spyOn(console, "groupCollapsed");
    vi.advanceTimersByTime(NOTIFIER_DEBOUNCE_MS + 10);
    expect(
      logSpy.mock.calls.some((args) => String(args[0]).includes("first committed change")),
    ).toBe(true);

    // Second commit: a rename shows up as a structured diff in a collapsed group.
    useDiagramStore.getState().updateComponent(alpha, { name: "Alpha Renamed" });
    vi.advanceTimersByTime(NOTIFIER_DEBOUNCE_MS + 10);
    expect(
      groupSpy.mock.calls.some(
        (args) => String(args[0]).includes("changed:") && String(args[0]).includes("renamed"),
      ),
    ).toBe(true);

    // Alt+Shift+O arranges root components in a grid via api.moveComponents.
    vi.advanceTimersByTime(2000); // get past history coalescing
    pressArrangeShortcut();
    const layouts = useDiagramStore.getState().diagrams[diagram.id].nodeLayouts;
    // Sorted by label: "Alpha Renamed" first cell, "Beta" second cell.
    expect(layouts[alpha]).toMatchObject({ x: 100, y: 100 });
    expect(layouts[beta]).toMatchObject({ x: 380, y: 100 });

    // One undo reverts the whole arrangement (spec scenario).
    vi.advanceTimersByTime(100);
    useDiagramStore.getState().undo();
    const reverted = useDiagramStore.getState().diagrams[diagram.id].nodeLayouts;
    expect(reverted[alpha]).toMatchObject({ x: 500, y: 500 });
    expect(reverted[beta]).toMatchObject({ x: 700, y: 900 });

    // Disabling the plugin removes its keyboard command (deactivate cleanup).
    await setPluginEnabled(PLUGIN_ID, false);
    vi.advanceTimersByTime(2000);
    pressArrangeShortcut();
    const afterDisable = useDiagramStore.getState().diagrams[diagram.id].nodeLayouts;
    expect(afterDisable[alpha]).toMatchObject({ x: 500, y: 500 });
  });
});
