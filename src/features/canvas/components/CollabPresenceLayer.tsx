import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ViewportPortal, useReactFlow, useStore, useStoreApi } from "@xyflow/react";
import { Eye, X } from "lucide-react";
import { useCollab, useCollabStore, type PeerState } from "@/features/collaboration";
import { flowToPane, outsideFollowZone } from "@/features/collaboration/utils/follow";
import { useResolvedComponents } from "@/features/diagram";

/**
 * Live presence drawn inside the canvas: this participant's cursor goes out in flow coordinates,
 * peers' cursors come back drawn in the viewport, so a cursor sits on the element its owner points
 * at whatever anyone's zoom, pan or window size. Following a peer keeps their cursor in view.
 *
 * Mounted as a child of the React Flow surface; renders nothing outside a session.
 */

/** Longest gap between two cursor frames this client sends. */
const CURSOR_INTERVAL_MS = 33;
/** How long recentering on a followed peer takes. */
const FOLLOW_PAN_MS = 300;

const NO_PEERS: PeerState[] = [];

export function CollabPresenceLayer() {
  const inSession = useCollabStore((state) => state.session !== null);
  if (!inSession) return null;
  return (
    <>
      <CursorBroadcast />
      <PeerCursors />
      <FollowPeer />
    </>
  );
}

/** Send this participant's pointer, in flow coordinates, at most every `CURSOR_INTERVAL_MS`. */
function CursorBroadcast() {
  const { updateCursor } = useCollab();
  const { screenToFlowPosition } = useReactFlow();
  const storeApi = useStoreApi();
  const domNode = useStore((state) => state.domNode);

  useEffect(() => {
    if (!domNode) return;
    let client: { x: number; y: number } | null = null;
    let lastSentAt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const send = () => {
      timer = null;
      if (!client) return;
      lastSentAt = performance.now();
      const point = screenToFlowPosition(client, { snapToGrid: false });
      updateCursor({ x: Math.round(point.x), y: Math.round(point.y) });
    };
    // Leading and trailing edge: the last position always goes out.
    const schedule = () => {
      if (timer) return;
      const wait = lastSentAt + CURSOR_INTERVAL_MS - performance.now();
      if (wait <= 0) send();
      else timer = setTimeout(send, wait);
    };
    const onMove = (event: PointerEvent) => {
      client = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const onLeave = () => {
      client = null;
      if (timer) clearTimeout(timer);
      timer = null;
      updateCursor(null);
    };
    // Panning or zooming moves the diagram under a still pointer: what it points at changes.
    const unsubscribe = storeApi.subscribe((state, previous) => {
      if (state.transform !== previous.transform) schedule();
    });

    domNode.addEventListener("pointermove", onMove);
    domNode.addEventListener("pointerleave", onLeave);
    return () => {
      domNode.removeEventListener("pointermove", onMove);
      domNode.removeEventListener("pointerleave", onLeave);
      unsubscribe();
      if (timer) clearTimeout(timer);
      updateCursor(null);
    };
  }, [domNode, screenToFlowPosition, storeApi, updateCursor]);

  return null;
}

/** Peers' cursors, placed in the viewport and counter-scaled so they keep one size on screen. */
function PeerCursors() {
  const { t } = useTranslation();
  const peers = useCollabStore((state) => state.session?.peers ?? NO_PEERS);
  const zoom = useStore((state) => state.transform[2]);
  const components = useResolvedComponents();

  return (
    <ViewportPortal>
      {peers.map((peer) => {
        if (!peer.cursor) return null;
        const name = peer.user.name || t("collaboration.peerFallback");
        const element = peer.activeElementId
          ? (components[peer.activeElementId]?.name ?? null)
          : null;
        return (
          <div
            key={peer.clientId}
            data-collab-cursor={peer.clientId}
            className="pointer-events-none absolute left-0 top-0 transition-transform duration-75 ease-linear"
            style={{
              transform: `translate(${peer.cursor.x}px, ${peer.cursor.y}px) scale(${1 / zoom})`,
              transformOrigin: "0 0",
              zIndex: 1000,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M0 0L0 11L3.5 8L6 14L8 13L5.5 7H10L0 0Z"
                fill={peer.user.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            <span
              className="absolute left-4 top-0 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
              style={{ backgroundColor: peer.user.color }}
            >
              {element ? `${name} • ${element}` : name}
            </span>
          </div>
        );
      })}
    </ViewportPortal>
  );
}

/**
 * While following a peer, recenter on their cursor whenever it leaves the middle of the pane.
 * Any pan, zoom or click of this participant's own, or Escape, hands control back.
 */
function FollowPeer() {
  const { t } = useTranslation();
  const following = useCollabStore((state) => state.following);
  const peer = useCollabStore((state) =>
    state.following
      ? (state.session?.peers.find((p) => p.clientId === state.following) ?? null)
      : null,
  );
  const setFollowing = useCollabStore((state) => state.setFollowing);
  const { setCenter, getViewport } = useReactFlow();
  const domNode = useStore((state) => state.domNode);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const stop = useCallback(() => setFollowing(null), [setFollowing]);

  // The peer left (or this client rejoined without them): nothing to follow.
  useEffect(() => {
    if (following && !peer) stop();
  }, [following, peer, stop]);

  const cursor = peer?.cursor ?? null;
  /**
   * The zoom to hold while following, taken when following starts. Reading it from the viewport
   * on every recenter drifted: a recenter still in flight reports an in-between zoom.
   */
  const followed = useRef<{ clientId: string; zoom: number } | null>(null);
  useEffect(() => {
    if (!following) {
      followed.current = null;
      return;
    }
    if (!cursor || width === 0 || height === 0) return;
    const first = followed.current?.clientId !== following;
    if (first) followed.current = { clientId: following, zoom: getViewport().zoom };
    const zoom = followed.current!.zoom;
    const onScreen = flowToPane(cursor, { ...getViewport(), zoom });
    if (!first && !outsideFollowZone(onScreen, { width, height })) return;
    // Linear: the default flight zooms out and back in on a long pan, which is disorienting
    // when it is someone else's hand moving the view.
    void setCenter(cursor.x, cursor.y, { zoom, duration: FOLLOW_PAN_MS, interpolate: "linear" });
  }, [following, cursor, width, height, getViewport, setCenter]);

  useEffect(() => {
    if (!following || !domNode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") stop();
    };
    domNode.addEventListener("wheel", stop, { passive: true });
    domNode.addEventListener("pointerdown", stop);
    window.addEventListener("keydown", onKey);
    return () => {
      domNode.removeEventListener("wheel", stop);
      domNode.removeEventListener("pointerdown", stop);
      window.removeEventListener("keydown", onKey);
    };
  }, [following, domNode, stop]);

  if (!peer) return null;
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-20 border-2"
        style={{ borderColor: peer.user.color }}
      />
      <div
        role="status"
        className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white shadow-md"
        style={{ backgroundColor: peer.user.color }}
      >
        <Eye className="h-3.5 w-3.5" aria-hidden />
        {t("collaboration.following", { name: peer.user.name })}
        <button
          type="button"
          onClick={stop}
          className="rounded-full p-0.5 hover:bg-white/20"
          title={t("collaboration.stopFollowing")}
          aria-label={t("collaboration.stopFollowing")}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    </>
  );
}
