import type { DiagramPatch, DiagramState, Entry } from "@collab-protocol";
import type { Diagram, DiagramSnapshot, DiagramStore } from "@/features/diagram";
import type { StoreApi } from "zustand";
import {
  applyPatchToCheckpoint,
  applyStateToDiagram,
  diagramToState,
  sameSyncedState,
} from "./diagramState";
import {
  applyEntry,
  captureLocal,
  initialSync,
  isSettled,
  markSent,
  refuseOp,
  visibleState,
  type SyncState,
} from "./rebase";

/**
 * Connects one diagram in the editor store to a room.
 *
 * - Outbound: every store change is captured as the unsent local change; a timer sends it at most
 *   every `sendIntervalMs` (leading and trailing edge), so a burst coalesces into one patch and
 *   the last state always goes out.
 * - Inbound: entries are applied the moment they arrive — never deferred to an animation frame,
 *   so a background tab stays current — and written back through a store update that skips undo
 *   history and touches only synchronised fields.
 * - Undo: a peer's change is carried into the local undo checkpoints, so undo reverts only the
 *   local user's own work.
 */

export interface BridgeTransport {
  /** Send a patch; returns its op id, or null when the connection is not ready. */
  sendPatch: (patch: DiagramPatch, baseVersion: number) => string | null;
}

export interface StoreBridgeOptions {
  store: StoreApi<DiagramStore>;
  diagramId: string;
  /** This participant's client id, to tell its own entries from a peer's. */
  selfId: string;
  transport: BridgeTransport;
  sendIntervalMs?: number;
}

export class StoreBridge {
  private sync: SyncState | null = null;
  private readonly store: StoreApi<DiagramStore>;
  private readonly diagramId: string;
  private readonly selfId: string;
  private readonly transport: BridgeTransport;
  private readonly interval: number;
  private lastSendAt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribe: (() => void) | null = null;
  private writing = false;

  constructor(options: StoreBridgeOptions) {
    this.store = options.store;
    this.diagramId = options.diagramId;
    this.selfId = options.selfId;
    this.transport = options.transport;
    this.interval = options.sendIntervalMs ?? 100;
  }

  /** Start capturing local edits. Idempotent. */
  attach(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = this.store.subscribe(() => {
      if (this.writing || !this.sync) return;
      this.schedule();
    });
  }

  detach(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get version(): number | null {
    return this.sync?.version ?? null;
  }

  /** The diagram as the editor holds it, for seeding a room. */
  currentState(): DiagramState | null {
    const diagram = this.diagram();
    return diagram ? diagramToState(diagram) : null;
  }

  /** The version this client can vouch for, or null when anything local is unconfirmed. */
  resumeVersion(): number | null {
    if (!this.sync) return null;
    this.capture();
    return isSettled(this.sync) ? this.sync.version : null;
  }

  // ── From the relay ──────────────────────────────────────────────────────

  /** The room's full state: it replaces everything, including unconfirmed local work. */
  onSnapshot(version: number, state: DiagramState): void {
    this.sync = initialSync(state, version);
    this.write(state, null);
  }

  /** Initial state for a host that just seeded the room from its own diagram. */
  onSeeded(state: DiagramState): void {
    this.sync = initialSync(state, 0);
  }

  /** Entries after the version this client vouched for (see `resumeVersion`). */
  onCatchup(entries: Entry[]): void {
    for (const entry of entries) this.onEntry(entry);
  }

  onEntry(entry: Entry): void {
    if (!this.sync) return;
    this.capture();
    this.sync = applyEntry(this.sync, entry);
    this.write(visibleState(this.sync), entry.sender === this.selfId ? null : entry.patch);
  }

  onAck(opId: string, applied: boolean): void {
    if (!this.sync || applied) return;
    this.capture();
    this.sync = refuseOp(this.sync, opId);
    this.write(visibleState(this.sync), null);
  }

  /** Send whatever local change is pending now. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.sync) return;
    this.capture();
    if (!this.sync.unsent) return;
    const opId = this.transport.sendPatch(this.sync.unsent, this.sync.version);
    if (opId === null) return;
    this.sync = markSent(this.sync, opId).sync;
    this.lastSendAt = Date.now();
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private diagram(): Diagram | undefined {
    return this.store.getState().diagrams[this.diagramId];
  }

  private capture(): void {
    if (!this.sync) return;
    const diagram = this.diagram();
    if (!diagram) return;
    this.sync = captureLocal(this.sync, diagramToState(diagram));
  }

  private schedule(): void {
    const wait = this.lastSendAt + this.interval - Date.now();
    if (wait <= 0) {
      this.flush();
      return;
    }
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush();
    }, wait);
  }

  /**
   * Put `state` in the editor. `remotePatch`, when given, is a peer's change to carry into the
   * undo checkpoints of this diagram.
   */
  private write(state: DiagramState, remotePatch: DiagramPatch | null): void {
    const current = this.diagram();
    const needsWrite = !current || !sameSyncedState(diagramToState(current), state);
    if (!needsWrite && !remotePatch) return;

    this.writing = true;
    try {
      this.store.setState((previous) => {
        const existing = previous.diagrams[this.diagramId];
        const now = Date.now();
        const base: Diagram = existing ?? {
          id: this.diagramId,
          name: "",
          level: "context",
          createdAt: now,
          updatedAt: now,
          snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
          nodeLayouts: {},
          edgeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
        };
        const next = needsWrite ? { ...applyStateToDiagram(base, state), updatedAt: now } : base;
        const rebase = (list: DiagramSnapshot[]): DiagramSnapshot[] =>
          remotePatch
            ? list.map((entry) =>
                entry.diagramId === this.diagramId
                  ? applyPatchToCheckpoint(entry, remotePatch)
                  : entry,
              )
            : list;
        return {
          ...previous,
          diagrams: needsWrite
            ? { ...previous.diagrams, [this.diagramId]: next }
            : previous.diagrams,
          past: rebase(previous.past),
          future: rebase(previous.future),
        };
      });
    } finally {
      this.writing = false;
    }
  }
}
