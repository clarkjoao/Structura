import type {
  CollabUser,
  DiagramPatch,
  DiagramState,
  Entry,
  Participant,
  SessionCloseReason,
} from "../protocol.js";

/**
 * Where a session lives. Session handlers talk only to this interface, so a relay pod holds no
 * state it cannot afford to lose. Two implementations: `MemoryRoomStore` (single instance, the
 * default) and `RedisRoomStore` (any number of pods). Both must pass the shared suite in
 * `store.contract.test.ts`.
 */

export type RoomStatus = "seeding" | "open" | "closed";

export interface RoomMeta {
  roomId: string;
  status: RoomStatus;
  version: number;
  hostTokenHash: string;
  hostUser: CollabUser;
  seedChunks: number;
  createdAt: number;
  /** Fresh for every creation of the room id; see `joined.epoch`. */
  epoch: string;
}

export type ApplyResult =
  | { status: "applied"; version: number; effective: DiagramPatch }
  | { status: "noop"; version: number }
  | { status: "not_open" };

export type CommitResult = { ok: true } | { ok: false; code: "invalid_seed" | "not_seeding" };

export type AddMemberResult = { ok: true; count: number } | { ok: false; reason: "full" };

/** Ordered events of one room, delivered to subscribers in version order. */
export type RoomEvent =
  { kind: "entry"; entry: Entry } | { kind: "closed"; reason: SessionCloseReason };

/** Ephemeral, lossy messages fanned out to every pod with sockets in the room. */
export type PresenceEvent =
  | {
      kind: "cursors";
      entries: Array<{
        clientId: string;
        cursor: { x: number; y: number } | null;
        activeElementId: string | null;
      }>;
    }
  | { kind: "peer:joined"; participant: Participant; participantCount: number }
  | { kind: "peer:left"; clientId: string; participantCount: number }
  | { kind: "host:status"; online: boolean }
  | { kind: "lock"; entityId: string; holder: string | null; ttlMs: number };

export type Unsubscribe = () => void;

export interface RoomStore {
  readonly kind: "memory" | "redis";

  /** Create a room in `seeding` state. `exists` when the id is taken. */
  createRoom(input: {
    roomId: string;
    hostTokenHash: string;
    hostUser: CollabUser;
    seedChunks: number;
    now: number;
  }): Promise<"created" | "exists">;
  appendSeedChunk(roomId: string, index: number, data: string): Promise<void>;
  /** Parse the seed, store it at version 0 and open the room. */
  commitSeed(roomId: string): Promise<CommitResult>;
  /** Remove a room that never opened (abandoned or invalid seed). */
  discardRoom(roomId: string): Promise<void>;

  getMeta(roomId: string): Promise<RoomMeta | null>;

  applyPatch(
    roomId: string,
    input: { patch: DiagramPatch; senderVersion: number; senderId: string; opId: string },
  ): Promise<ApplyResult>;
  /** The whole state at a single version. */
  readSnapshot(roomId: string): Promise<{ version: number; state: DiagramState } | null>;
  /** Entries after `fromVersion`, or null when the log no longer covers that span. */
  readEntries(roomId: string, fromVersion: number): Promise<Entry[] | null>;
  /**
   * Deliver every room event that happens after this call, in order. Callers that need a
   * consistent start subscribe first, then read the snapshot, then drop events at or below it.
   */
  subscribe(roomId: string, listener: (event: RoomEvent) => void): Promise<Unsubscribe>;

  /** `connId` identifies the socket, so a stale socket cannot remove its own replacement. */
  addMember(
    roomId: string,
    member: Participant,
    connId: string,
    expiresAt: number,
    maxParticipants: number,
    now: number,
  ): Promise<AddMemberResult>;
  touchMembers(roomId: string, clientIds: string[], expiresAt: number): Promise<void>;
  /** Removes only if `connId` still owns the membership; returns the remaining count. */
  removeMember(roomId: string, clientId: string, connId: string, now: number): Promise<number>;
  listMembers(roomId: string, now: number): Promise<Participant[]>;

  /** Acquire or renew. Granted when free or already held by `clientId`. */
  acquireLock(
    roomId: string,
    entityId: string,
    clientId: string,
    ttlMs: number,
  ): Promise<{ granted: boolean; holder: string | null }>;
  releaseLock(roomId: string, entityId: string, clientId: string): Promise<boolean>;

  renewHostLease(roomId: string, expiresAt: number): Promise<void>;
  /** Rooms whose host lease expired before `before`. */
  expiredHostLeases(before: number): Promise<string[]>;
  /** Mark the host offline once; true only for the call that flipped it. */
  markHostOffline(roomId: string): Promise<boolean>;
  markHostOnline(roomId: string): Promise<void>;
  isHostOnline(roomId: string): Promise<boolean>;

  /** Close and schedule removal. True only for the call that closed it. */
  closeRoom(roomId: string, reason: SessionCloseReason): Promise<boolean>;

  publishPresence(roomId: string, event: PresenceEvent): Promise<void>;
  subscribePresence(roomId: string, listener: (event: PresenceEvent) => void): Promise<Unsubscribe>;

  close(): Promise<void>;
}
