import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useCollabStore } from "@/features/collaboration/store/collab.store";
import { useCollabHighlight } from "@/features/collaboration/hooks/useCollabHighlight";
import { usePeerOnNode } from "./usePeerOnNode";

const ana = { id: "ana", name: "Ana", color: "#f00" };
const bia = { id: "bia", name: "Bia", color: "#00f" };

function startSession() {
  useCollabStore.getState().setSession({
    roomId: "room",
    isHost: true,
    localUser: { id: "me", name: "Me", color: "#000" },
    status: "connected",
    peers: [
      { clientId: "ana", user: ana, cursor: null, activeElementId: null },
      { clientId: "bia", user: bia, cursor: null, activeElementId: null },
    ],
  });
  useCollabStore.getState().applyLocks(new Map([["n1", { holder: "ana", expiresAt: 0 }]]));
}

afterEach(() => {
  act(() => useCollabStore.getState().reset());
});

describe("presence on a node", () => {
  it("does not re-render a node while its lock holder only moves the cursor", () => {
    act(startSession);
    let renders = 0;
    const { result } = renderHook(() => {
      renders += 1;
      return { peer: usePeerOnNode("n1"), highlight: useCollabHighlight("n1") };
    });
    expect(result.current.peer).toBe(ana);
    expect(result.current.highlight).toMatchObject({ userName: "Ana", locked: true });
    const before = renders;

    act(() => {
      for (let x = 0; x < 20; x++) {
        useCollabStore.getState().applyCursors([
          { clientId: "ana", cursor: { x, y: x }, activeElementId: null },
          { clientId: "bia", cursor: { x, y: 0 }, activeElementId: null },
        ]);
      }
    });
    expect(renders).toBe(before);
  });

  it("shows a peer that selects the node", () => {
    act(startSession);
    const { result } = renderHook(() => useCollabHighlight("n2"));
    expect(result.current).toBeNull();
    act(() =>
      useCollabStore
        .getState()
        .applyCursors([{ clientId: "bia", cursor: null, activeElementId: "n2" }]),
    );
    expect(result.current).toMatchObject({ userName: "Bia", locked: false });
  });
});
