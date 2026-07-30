import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HISTORY_COALESCE_MS,
  MAX_HISTORY_STEPS,
  STRUCTURAL_MUTATION_MARKER,
  UNDO_REDO_COOLDOWN_MS,
} from "../store.constants";
import { createTestDiagramStore } from "../test-utils";
import { pushHistory } from "./history.slice";

describe("historySlice", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-01T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pushHistory records a checkpoint of the current diagram snapshot", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("Hist", "context");
    store.getState().openDiagram(diagram.id);
    store.setState((state) => {
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
    });
    const pastEntry = store.getState().past[0];
    expect(pastEntry?.diagramId).toBe(diagram.id);
    expect(pastEntry?.snapshot).toEqual(diagram.snapshot);
  });

  it("undo restores the previous snapshot", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("U", "context");
    store.getState().openDiagram(diagram.id);
    store.getState().addComponent("system", "N1", null, { x: 10, y: 20 });
    expect(Object.keys(store.getState().diagrams[diagram.id]!.snapshot.components)).toHaveLength(1);
    store.getState().undo();
    expect(Object.keys(store.getState().diagrams[diagram.id]!.snapshot.components)).toHaveLength(0);
  });

  it("redo restores a snapshot that was undone", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("R", "context");
    store.getState().openDiagram(diagram.id);
    store.getState().addComponent("system", "N1", null, { x: 1, y: 2 });
    store.getState().undo();
    expect(Object.keys(store.getState().diagrams[diagram.id]!.snapshot.components)).toHaveLength(0);
    store.getState().redo();
    expect(Object.keys(store.getState().diagrams[diagram.id]!.snapshot.components)).toHaveLength(1);
  });

  it("clears future after a new mutation following undo", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("F", "context");
    store.getState().openDiagram(diagram.id);
    store.getState().addComponent("system", "A", null, { x: 1, y: 1 });
    store.getState().addComponent("system", "B", null, { x: 2, y: 2 });
    store.getState().undo();
    expect(store.getState().future.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
    store.getState().addComponent("system", "C", null, { x: 3, y: 3 });
    expect(store.getState().future).toHaveLength(0);
  });

  it("coalesces two soft mutations within HISTORY_COALESCE_MS into one checkpoint", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("C", "context");
    store.getState().openDiagram(diagram.id);
    const node = store.getState().addComponent("system", "N0", null, { x: 1, y: 1 });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
    store.getState().updateComponent(node.id, { name: "First" });
    const pastAfterFirst = store.getState().past.length;
    vi.advanceTimersByTime(100);
    store.getState().updateComponent(node.id, { name: "Second" });
    expect(store.getState().past.length).toBe(pastAfterFirst);
  });

  it("creates separate checkpoints when soft mutations are farther apart than HISTORY_COALESCE_MS", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("S", "context");
    store.getState().openDiagram(diagram.id);
    const node = store.getState().addComponent("system", "N0", null, { x: 1, y: 1 });
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
    store.getState().updateComponent(node.id, { name: "A" });
    const pastAfterFirst = store.getState().past.length;
    vi.advanceTimersByTime(HISTORY_COALESCE_MS + 1);
    store.getState().updateComponent(node.id, { name: "B" });
    expect(store.getState().past.length).toBe(pastAfterFirst + 1);
  });

  it("drops the oldest checkpoint when past exceeds MAX_HISTORY_STEPS", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("M", "context");
    store.getState().openDiagram(diagram.id);
    for (let index = 0; index < MAX_HISTORY_STEPS + 1; index += 1) {
      vi.advanceTimersByTime(UNDO_REDO_COOLDOWN_MS + 1);
      store.setState((state) => {
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      });
    }
    expect(store.getState().past.length).toBe(MAX_HISTORY_STEPS);
  });

  it("does not push a new checkpoint within UNDO_REDO_COOLDOWN_MS after redo", () => {
    const store = createTestDiagramStore();
    const diagram = store.getState().addDiagram("CD", "context");
    store.getState().openDiagram(diagram.id);
    store.getState().addComponent("system", "One", null, { x: 1, y: 1 });
    store.getState().undo();
    store.getState().redo();
    const pastLengthAfterRedo = store.getState().past.length;
    vi.advanceTimersByTime(UNDO_REDO_COOLDOWN_MS - 1);
    store.setState((state) => {
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
    });
    expect(store.getState().past.length).toBe(pastLengthAfterRedo);
    vi.advanceTimersByTime(2);
    store.setState((state) => {
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
    });
    expect(store.getState().past.length).toBe(pastLengthAfterRedo + 1);
  });
});
