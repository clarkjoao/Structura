import type { CollabUser, CursorEntry, DiagramState, Participant } from "@collab-protocol";
import type { DiagramStore } from "@/features/diagram";
import type { StoreApi } from "zustand";
import type { CollabStoreState } from "../store/collab.store";
import type { CollabStatus, PeerState } from "../types";
import { CollabClient, type ClientPhase, type ClosedReason, type SocketLike } from "./CollabClient";
import { StoreBridge } from "./StoreBridge";

/**
 * One live session, wired end to end: the socket client, the store bridge for the shared diagram,
 * and the presence/status state the UI reads from the collaboration store. No React here; the
 * provider owns an instance per session.
 */

export interface CollabSessionOptions {
  url: string;
  roomId: string;
  user: CollabUser;
  role: "host" | "guest";
  /** Host: the diagram being shared. Guest: learned from the room. */
  diagramId: string | null;
  hostToken?: string | null;
  diagramStore: StoreApi<DiagramStore>;
  collabStore: StoreApi<CollabStoreState>;
  onHostToken?: (token: string) => void;
  /** A lock this participant asked for is held by someone else. */
  onLockDenied?: (entityId: string, holderName: string) => void;
  /** The session is over for this participant (not a reconnect). */
  onEnded?: (reason: ClosedReason) => void;
  createSocket?: (url: string) => SocketLike;
  sendIntervalMs?: number;
  reconnectDelaysMs?: number[];
}

function toStatus(phase: ClientPhase): CollabStatus {
  switch (phase) {
    case "idle":
      return "idle";
    case "connecting":
    case "seeding":
    case "joining":
      return "connecting";
    case "ready":
      return "connected";
    case "reconnecting":
      return "reconnecting";
    case "closed":
      return "closed";
  }
}

function toPeer(participant: Participant): PeerState {
  return {
    clientId: participant.clientId,
    user: participant.user,
    cursor: null,
    activeElementId: null,
  };
}

export class CollabSession {
  readonly client: CollabClient;
  private bridge: StoreBridge | null = null;
  private diagramId: string | null;
  private selfId: string;
  private cursor: { x: number; y: number } | null = null;
  private activeElementId: string | null = null;
  private lockExpiry = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly opts: CollabSessionOptions;

  constructor(options: CollabSessionOptions) {
    this.opts = options;
    this.diagramId = options.diagramId;
    this.selfId = options.user.id;
    if (options.role === "host" && options.diagramId) {
      this.bridge = this.makeBridge(options.diagramId);
    }

    this.client = new CollabClient({
      url: options.url,
      roomId: options.roomId,
      user: options.user,
      role: options.role,
      hostToken: options.hostToken ?? null,
      createSocket: options.createSocket,
      reconnectDelaysMs: options.reconnectDelaysMs,
      getSeed: options.role === "host" ? () => this.seed() : undefined,
      getResumeVersion: () => this.bridge?.resumeVersion() ?? null,
      callbacks: {
        onPhase: (phase) => this.collab().setStatus(toStatus(phase)),
        onHostToken: (token) => options.onHostToken?.(token),
        onJoined: (info) => {
          this.selfId = info.clientId;
          const collab = this.collab();
          collab.setPeers(
            info.participants.filter((p) => p.clientId !== info.clientId).map(toPeer),
          );
          collab.setParticipantCount(info.participants.length, info.maxParticipants);
          collab.setHostOnline(info.hostOnline);
          collab.setHostName(info.participants.find((p) => p.role === "host")?.user.name ?? null);
        },
        onSnapshot: (version, state) => this.onSnapshot(version, state),
        onCatchup: (_version, entries) => {
          this.bridge?.onCatchup(entries);
          this.collab().setIsReady(true);
        },
        onEntry: (entry) => this.bridge?.onEntry(entry),
        onAck: (opId, applied) => this.bridge?.onAck(opId, applied),
        onPeerJoined: (participant, count) => {
          const collab = this.collab();
          if (participant.clientId !== this.selfId) collab.upsertPeer(toPeer(participant));
          if (participant.role === "host") collab.setHostName(participant.user.name);
          collab.setParticipantCount(count, collab.maxParticipants);
        },
        onPeerLeft: (clientId, count) => {
          const collab = this.collab();
          collab.removePeer(clientId);
          collab.setParticipantCount(count, collab.maxParticipants);
        },
        onHostStatus: (online) => this.collab().setHostOnline(online),
        onCursors: (entries) => this.onCursors(entries),
        onLock: (entityId, holder, ttlMs) => this.onLock(entityId, holder, ttlMs),
        onLockResult: (entityId, granted, holder) => {
          if (granted || !holder) return;
          const peer = this.collab().session?.peers.find((p) => p.clientId === holder);
          options.onLockDenied?.(entityId, peer?.user.name ?? holder);
        },
        onClosed: (reason, detail) => {
          this.bridge?.detach();
          if (reason !== "left") {
            this.collab().setEnded(reason, detail);
            if (reason === "room_full") {
              this.collab().setRoomFullReason(
                detail?.limit !== undefined ? String(detail.limit) : "full",
              );
            }
          }
          options.onEnded?.(reason);
        },
      },
    });
  }

  start(): void {
    const collab = this.collab();
    collab.setSession({
      roomId: this.opts.roomId,
      isHost: this.opts.role === "host",
      localUser: this.opts.user,
      peers: [],
      status: "connecting",
    });
    this.client.start();
  }

  /** End participation; for the host this ends the session for everyone. */
  leave(): void {
    this.bridge?.flush();
    this.client.leave();
    this.dispose();
  }

  updateCursor(cursor: { x: number; y: number } | null): void {
    this.cursor = cursor;
    this.client.sendCursor(cursor, this.activeElementId);
  }

  updateActiveElement(id: string | null): void {
    if (this.activeElementId === id) return;
    this.activeElementId = id;
    this.client.sendCursor(this.cursor, id);
  }

  get hostToken(): string | null {
    return this.client.credential;
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private collab(): CollabStoreState {
    return this.opts.collabStore.getState();
  }

  private makeBridge(diagramId: string): StoreBridge {
    const bridge = new StoreBridge({
      store: this.opts.diagramStore,
      diagramId,
      selfId: this.opts.user.id,
      sendIntervalMs: this.opts.sendIntervalMs,
      transport: { sendPatch: (patch, base) => this.client.sendPatch(patch, base) },
    });
    bridge.attach();
    return bridge;
  }

  /** Host: the diagram as it stands, which becomes the room's version 0. */
  private seed(): DiagramState {
    const bridge = this.bridge;
    const state = bridge?.currentState();
    if (!bridge || !state) throw new Error("collab: the shared diagram is not loaded");
    bridge.onSeeded(state);
    return state;
  }

  private onSnapshot(version: number, state: DiagramState): void {
    const diagramId =
      this.diagramId ?? (typeof state.doc.diagramId === "string" ? state.doc.diagramId : null);
    if (!diagramId) return;
    if (!this.bridge) {
      this.diagramId = diagramId;
      this.bridge = this.makeBridge(diagramId);
    }
    this.bridge.onSnapshot(version, state);
    if (this.opts.role === "guest") {
      this.opts.diagramStore.setState({ activeDiagramId: diagramId });
    }
    this.collab().setIsReady(true);
  }

  private onCursors(entries: CursorEntry[]): void {
    const collab = this.collab();
    const peers = collab.session?.peers ?? [];
    for (const entry of entries) {
      if (entry.clientId === this.selfId) continue;
      const peer = peers.find((p) => p.clientId === entry.clientId);
      if (!peer) continue;
      collab.applyPeerCursorPayload({
        clientId: entry.clientId,
        user: peer.user,
        cursor: entry.cursor,
        activeElementId: entry.activeElementId,
        preserveCursorIfMessageNull: false,
      });
    }
  }

  private onLock(entityId: string, holder: string | null, ttlMs: number): void {
    const collab = this.collab();
    const pending = this.lockExpiry.get(entityId);
    if (pending) clearTimeout(pending);
    this.lockExpiry.delete(entityId);
    if (holder === null || holder === this.selfId) {
      collab.setLock(entityId, null);
      return;
    }
    collab.setLock(entityId, { holder, expiresAt: Date.now() + ttlMs });
    // A holder that vanished stops renewing; forget the lock when its ttl runs out.
    this.lockExpiry.set(
      entityId,
      setTimeout(() => {
        this.lockExpiry.delete(entityId);
        this.collab().setLock(entityId, null);
      }, ttlMs),
    );
  }

  private dispose(): void {
    this.bridge?.detach();
    for (const timer of this.lockExpiry.values()) clearTimeout(timer);
    this.lockExpiry.clear();
  }

  /** Drop the connection without ending the session (unmount, navigation). */
  disconnect(): void {
    this.bridge?.flush();
    this.client.leaveSilently();
    this.dispose();
  }
}
