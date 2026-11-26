import type { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import type { Node } from "@xyflow/react";
import { LIMITS } from "@collab-protocol";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CollabContext, type CollabContextValue } from "../components/collab-context";
import { useElementTextLock, useNodeDragLocks } from "../hooks/useElementLocks";
import { useCollabStore } from "../store/collab.store";
import type { CollabSession } from "../types";

const session: CollabSession = {
  roomId: "room",
  isHost: false,
  localUser: { id: "me", name: "Me", color: "#111" },
  peers: [
    {
      clientId: "peer-1",
      user: { id: "peer-1", name: "Ana", color: "#222" },
      cursor: null,
      activeElementId: null,
    },
  ],
  status: "connected",
};

function setup(active = true) {
  const lockElements = vi.fn();
  const renewElementLocks = vi.fn();
  const unlockElements = vi.fn();
  const value = {
    session: active ? session : null,
    lockElements,
    renewElementLocks,
    unlockElements,
  } as unknown as CollabContextValue;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CollabContext.Provider value={value}>{children}</CollabContext.Provider>
  );
  return { wrapper, lockElements, renewElementLocks, unlockElements };
}

const node = (id: string, extra: Partial<Node> = {}): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});

beforeEach(() => {
  vi.useFakeTimers();
  useCollabStore.getState().reset();
  useCollabStore.getState().setSession(session);
});
afterEach(() => {
  vi.useRealTimers();
  useCollabStore.getState().reset();
});

const RENEW_MS = Math.floor(LIMITS.lockTtlMs / 3);

describe("useNodeDragLocks", () => {
  it("a node a peer holds cannot be dragged here; the others still can", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useNodeDragLocks(), { wrapper });
    const nodes = [node("a"), node("b"), node("c", { draggable: false })];

    expect(result.current.applyLocks(nodes)).toBe(nodes);

    act(() =>
      useCollabStore.getState().setLock("a", { holder: "peer-1", expiresAt: Date.now() + 3000 }),
    );
    const locked = result.current.applyLocks(nodes);
    expect(locked.map((n) => n.draggable)).toEqual([false, undefined, false]);
    expect(locked[1]).toBe(nodes[1]);

    act(() => useCollabStore.getState().setLock("a", null));
    expect(result.current.applyLocks(nodes)).toBe(nodes);
  });

  it("takes the locks of the whole dragged selection at once, keeps them alive, frees on stop", () => {
    const { wrapper, lockElements, renewElementLocks, unlockElements } = setup();
    const { result } = renderHook(() => useNodeDragLocks(), { wrapper });

    act(() => result.current.onNodeDragStart({}, node("a"), [node("a"), node("b"), node("a")]));
    expect(lockElements).toHaveBeenCalledTimes(1);
    expect(lockElements).toHaveBeenCalledWith(["a", "b"]);

    act(() => void vi.advanceTimersByTime(RENEW_MS * 2));
    expect(renewElementLocks).toHaveBeenCalledTimes(2);
    expect(renewElementLocks).toHaveBeenCalledWith(["a", "b"]);

    act(() => result.current.onNodeDragStop());
    expect(unlockElements).toHaveBeenCalledWith(["a", "b"]);
    act(() => void vi.advanceTimersByTime(RENEW_MS * 3));
    expect(renewElementLocks).toHaveBeenCalledTimes(2);
  });

  it("a drag that starts while another is held frees the first, never leaking a renew timer", () => {
    const { wrapper, renewElementLocks, unlockElements } = setup();
    const { result } = renderHook(() => useNodeDragLocks(), { wrapper });

    act(() => result.current.onNodeDragStart({}, node("a")));
    act(() => result.current.onNodeDragStart({}, node("b")));
    expect(unlockElements).toHaveBeenCalledWith(["a"]);

    act(() => void vi.advanceTimersByTime(RENEW_MS));
    expect(renewElementLocks).toHaveBeenCalledTimes(1);
    expect(renewElementLocks).toHaveBeenCalledWith(["b"]);
  });

  it("releases its locks when the canvas unmounts mid-drag", () => {
    const { wrapper, renewElementLocks, unlockElements } = setup();
    const { result, unmount } = renderHook(() => useNodeDragLocks(), { wrapper });
    act(() => result.current.onNodeDragStart({}, node("a")));
    unmount();
    expect(unlockElements).toHaveBeenCalledWith(["a"]);
    vi.advanceTimersByTime(RENEW_MS * 3);
    expect(renewElementLocks).not.toHaveBeenCalled();
  });

  it("asks for nothing outside a session", () => {
    const { wrapper, lockElements } = setup(false);
    const { result } = renderHook(() => useNodeDragLocks(), { wrapper });
    act(() => result.current.onNodeDragStart({}, node("a")));
    expect(lockElements).not.toHaveBeenCalled();
  });
});

describe("useElementTextLock", () => {
  it("names the peer who holds the element's text, and falls back to the client id", () => {
    const { wrapper } = setup();
    const { result } = renderHook(() => useElementTextLock("a"), { wrapper });
    expect(result.current.lockedBy).toBeNull();

    act(() =>
      useCollabStore.getState().setLock("a", { holder: "peer-1", expiresAt: Date.now() + 3000 }),
    );
    expect(result.current.lockedBy).toBe("Ana");

    act(() =>
      useCollabStore.getState().setLock("a", { holder: "ghost", expiresAt: Date.now() + 3000 }),
    );
    expect(result.current.lockedBy).toBe("ghost");
  });

  it("focus takes the element's lock, blur frees it", () => {
    const { wrapper, lockElements, unlockElements } = setup();
    const { result } = renderHook(() => useElementTextLock("a"), { wrapper });
    act(() => result.current.onFocus());
    expect(lockElements).toHaveBeenCalledWith(["a"]);
    act(() => result.current.onBlur());
    expect(unlockElements).toHaveBeenCalledWith(["a"]);
  });

  it("without an element there is nothing to lock or to be locked by", () => {
    const { wrapper, lockElements } = setup();
    const { result } = renderHook(() => useElementTextLock(null), { wrapper });
    act(() => result.current.onFocus());
    expect(lockElements).not.toHaveBeenCalled();
    expect(result.current.lockedBy).toBeNull();
  });

  it("reports no holder outside a session", () => {
    const { wrapper } = setup(false);
    act(() =>
      useCollabStore.getState().setLock("a", { holder: "peer-1", expiresAt: Date.now() + 3000 }),
    );
    const { result } = renderHook(() => useElementTextLock("a"), { wrapper });
    expect(result.current.lockedBy).toBeNull();
  });
});
