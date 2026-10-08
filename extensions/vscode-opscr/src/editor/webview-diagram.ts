import type { DiagramPort } from "../generated/opscr-engine/engine";
import type {
  DiagramSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
} from "../generated/opscr-engine/plugin-types";

/** The editable embed's protocol (src/embed/editor/protocol.ts in the host). */
export const EDITOR_READY = "STRUCTURA_EDITOR_READY";
export const EDITOR_SNAPSHOT = "STRUCTURA_EDITOR_SNAPSHOT";
export const EDITOR_APPLIED = "STRUCTURA_EDITOR_APPLIED";
export const EDITOR_APPLY = "STRUCTURA_EDITOR_APPLY";

/**
 * The engine's diagram, over the webview: changes go out as APPLY requests and resolve with the
 * embed's answer; the diagram is the latest snapshot the embed sent — with each answer, so the
 * engine never works from a picture older than its own change.
 */
export class WebviewDiagram implements DiagramPort {
  private snapshot: DiagramSnapshot | null = null;
  private nextRequest = 1;
  private readonly pending = new Map<number, (result: PluginDiagramChangesResult) => void>();

  constructor(private readonly post: (message: unknown) => void) {}

  get(): DiagramSnapshot | null {
    return this.snapshot;
  }

  apply(changes: PluginDiagramChanges): Promise<PluginDiagramChangesResult> {
    const requestId = this.nextRequest++;
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
      this.post({ type: EDITOR_APPLY, requestId, changes });
    });
  }

  /** A message from the embed. Says what it was, for the caller to react to. */
  receive(message: unknown): "ready" | "snapshot" | "applied" | null {
    if (typeof message !== "object" || message === null) return null;
    const data = message as Record<string, unknown>;
    if (data["type"] === EDITOR_READY) {
      this.snapshot = null;
      for (const resolve of this.pending.values()) resolve({ idsByKey: {}, connectionIds: [] });
      this.pending.clear();
      return "ready";
    }
    if (data["type"] === EDITOR_SNAPSHOT && data["diagram"]) {
      this.snapshot = data["diagram"] as DiagramSnapshot;
      return "snapshot";
    }
    if (data["type"] === EDITOR_APPLIED && typeof data["requestId"] === "number") {
      if (data["diagram"]) this.snapshot = data["diagram"] as DiagramSnapshot;
      const resolve = this.pending.get(data["requestId"]);
      this.pending.delete(data["requestId"]);
      resolve?.(data["result"] as PluginDiagramChangesResult);
      return "applied";
    }
    return null;
  }
}
