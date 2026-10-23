import type { DiagramPatch, DiagramState, Entry } from "@collab-protocol";
import type { Diagram, DiagramSnapshot, DiagramStore } from "@/features/diagram";
import type { StoreApi } from "zustand";
import {
  applyPatchToCheckpoint,
  applyStateToDiagram,
  diagramToState,
  LEGACY_DOC_FIELD_SET,
  sameSyncedState,
  type DocFieldSet,
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
 * - Inbound: entries and refusals are queued and applied together, at most every
 *   `inboundBatchMs`, in one store update that skips undo history and touches only synchronised
 *   fields. Every store update re-renders the canvas, so one update per entry made the cost grow
 *   with the number of people editing: past a few busy peers the tab fell behind and never caught
 *   up. The window is a timer, never an animation frame, and a hidden tab applies at once — so a
 *   background tab stays current. Anything that reads or sends local state drains the queue
 *   first: a local edit is always measured against the state the editor was last given.
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
  /** Longest an incoming entry waits to be batched with the next ones; 0 applies each at once. */
  inboundBatchMs?: number;
  /** The doc fields the relay accepts; the legacy set until `joined` declares more. */
  docFields?: DocFieldSet;
}

type Inbound = { kind: "entry"; entry: Entry } | { kind: "refused"; opId: string };

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
  private readonly inboundBatchMs: number;
  private inbound: Inbound[] = [];
  private inboundTimer: ReturnType<typeof setTimeout> | null = null;
  private docFields: DocFieldSet;

  constructor(options: StoreBridgeOptions) {
    this.store = options.store;
    this.diagramId = options.diagramId;
    this.selfId = options.selfId;
    this.transport = options.transport;
    this.interval = options.sendIntervalMs ?? 100;
    this.inboundBatchMs = options.inboundBatchMs ?? 32;
    this.docFields = options.docFields ?? LEGACY_DOC_FIELD_SET;
  }

  /**
   * The relay declared the doc fields it accepts (`joined.docFields`). Fields new to this
   * session — the reading direction, the arrange settings — then show up as a local change and
   * go out with the next send, so the room learns them right after joining.
   */
  setDocFields(fields: DocFieldSet): void {
    this.docFields = fields;
    if (this.sync) this.schedule();
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
    this.drain();
    this.unsubscribe?.();
    this.unsubscribe = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  get version(): number | null {
    return this.sync?.version ?? null;
  }

  /**
   * The diagram as the editor holds it, for seeding a room. Always the legacy fields: the seed
   * goes out before the relay has said what it accepts, and an older relay refuses a seed with
   * any other. The rest follows as a patch once `joined` declares it (`setDocFields`).
   */
  currentState(): DiagramState | null {
    this.drain();
    const diagram = this.diagram();
    return diagram ? diagramToState(diagram, LEGACY_DOC_FIELD_SET) : null;
  }

  /** The version this client can vouch for, or null when anything local is unconfirmed. */
  resumeVersion(): number | null {
    if (!this.sync) return null;
    this.drain();
    this.capture();
    return isSettled(this.sync) ? this.sync.version : null;
  }

  // ── From the relay ──────────────────────────────────────────────────────

  /** The room's full state: it replaces everything, including unconfirmed local work. */
  onSnapshot(version: number, state: DiagramState): void {
    this.dropInbound();
    this.sync = initialSync(state, version);
    this.write(state, []);
  }

  /** Initial state for a host that just seeded the room from its own diagram. */
  onSeeded(state: DiagramState): void {
    this.dropInbound();
    this.sync = initialSync(state, 0);
  }

  /** Entries after the version this client vouched for (see `resumeVersion`). */
  onCatchup(entries: Entry[]): void {
    for (const entry of entries) this.inbound.push({ kind: "entry", entry });
    this.drain();
  }

  onEntry(entry: Entry): void {
    if (!this.sync) return;
    this.enqueue({ kind: "entry", entry });
  }

  onAck(opId: string, applied: boolean): void {
    if (!this.sync || applied) return;
    this.enqueue({ kind: "refused", opId });
  }

  /** Apply everything queued from the relay, in arrival order, with one store update. */
  drain(): void {
    if (this.inboundTimer) clearTimeout(this.inboundTimer);
    this.inboundTimer = null;
    if (!this.sync || this.inbound.length === 0) return;
    const queued = this.inbound;
    this.inbound = [];
    // Local edits are measured against what the editor holds now, before any of the batch.
    this.capture();
    const remotePatches: DiagramPatch[] = [];
    for (const item of queued) {
      if (item.kind === "refused") {
        this.sync = refuseOp(this.sync, item.opId);
        continue;
      }
      if (item.entry.version <= this.sync.version) continue;
      this.sync = applyEntry(this.sync, item.entry);
      if (item.entry.sender !== this.selfId) remotePatches.push(item.entry.patch);
    }
    this.write(visibleState(this.sync), remotePatches);
  }

  /** Send whatever local change is pending now. */
  flush(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.sync) return;
    this.drain();
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
    this.sync = captureLocal(this.sync, diagramToState(diagram, this.docFields));
  }

  private enqueue(item: Inbound): void {
    this.inbound.push(item);
    const hidden = typeof document !== "undefined" && document.hidden;
    if (this.inboundBatchMs <= 0 || hidden) {
      this.drain();
      return;
    }
    this.inboundTimer ??= setTimeout(() => this.drain(), this.inboundBatchMs);
  }

  private dropInbound(): void {
    if (this.inboundTimer) clearTimeout(this.inboundTimer);
    this.inboundTimer = null;
    this.inbound = [];
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
   * Put `state` in the editor. `remotePatches` are peers' changes, in order, to carry into the
   * undo checkpoints of this diagram.
   */
  private write(state: DiagramState, remotePatches: DiagramPatch[]): void {
    const current = this.diagram();
    const needsWrite = !current || !sameSyncedState(diagramToState(current, this.docFields), state);
    if (!needsWrite && remotePatches.length === 0) return;

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
          remotePatches.length > 0
            ? list.map((entry) =>
                entry.diagramId === this.diagramId
                  ? remotePatches.reduce(applyPatchToCheckpoint, entry)
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
          _lastRemoteWriteAt: (previous._lastRemoteWriteAt ?? 0) + 1,
        };
      });
    } finally {
      this.writing = false;
    }
  }
}
