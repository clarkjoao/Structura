/**
 * The status of a plugin-owned Version is the plugin's to set (an opscr initiative's status lives
 * in its file): the Versions panel delivers it to the plugin and leaves the store alone.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "@/infrastructure/i18n";
import { useDiagramStore } from "@/features/diagram";
import type { PluginVersionAction } from "@/features/plugins/plugin.types";
import { onVersionAction } from "@/features/plugins/version-actions";
import { ConnectedVersionPanel } from "./VersionPanel";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

describe("Versions panel status of a plugin-owned Version", () => {
  let off: () => void = () => {};
  beforeEach(() => i18n.changeLanguage("en"));
  afterEach(() => off());

  it("goes to the owning plugin, not into the store", () => {
    const store = useDiagramStore.getState();
    const diagram = store.addDiagram(`Owned ${Math.random()}`, "container");
    store.openDiagram(diagram.id);
    const version = store.addVersion("Order events");
    useDiagramStore.setState((state) => {
      const v = state.diagrams[diagram.id]!.versions![version.id]!;
      v.key = "order-events";
      v.ownerPluginId = "structura-plugin-opscr";
      v.status = "in-progress";
    });
    const seen: PluginVersionAction[] = [];
    off = onVersionAction("structura-plugin-opscr", (action) => seen.push(action));

    render(<ConnectedVersionPanel onClose={() => {}} />);
    const row = screen.getByText("Order events");
    fireEvent.mouseEnter(row.closest("[data-version-row]") ?? row.parentElement!);
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "done" } });

    expect(seen).toEqual([
      { type: "status", diagramId: diagram.id, key: "order-events", status: "done" },
    ]);
    expect(useDiagramStore.getState().diagrams[diagram.id]!.versions![version.id]!.status).toBe(
      "in-progress",
    );
  });
});
