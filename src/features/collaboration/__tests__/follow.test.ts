import { describe, expect, it } from "vitest";
import { createCollabStore } from "../store/collab.store";
import { flowToPane, outsideFollowZone } from "../utils/follow";

describe("cursor geometry", () => {
  it("maps a flow point through the viewer's own pan and zoom", () => {
    expect(flowToPane({ x: 100, y: 50 }, { x: 0, y: 0, zoom: 1 })).toEqual({ x: 100, y: 50 });
    expect(flowToPane({ x: 100, y: 50 }, { x: -40, y: 10, zoom: 2 })).toEqual({ x: 160, y: 110 });
    expect(flowToPane({ x: 100, y: 50 }, { x: 20, y: 0, zoom: 0.5 })).toEqual({ x: 70, y: 25 });
  });

  it("recenters only once the cursor leaves the middle of the pane", () => {
    const pane = { width: 1000, height: 500 };
    expect(outsideFollowZone({ x: 500, y: 250 }, pane)).toBe(false);
    expect(outsideFollowZone({ x: 210, y: 110 }, pane)).toBe(false);
    expect(outsideFollowZone({ x: 190, y: 250 }, pane)).toBe(true);
    expect(outsideFollowZone({ x: 500, y: 460 }, pane)).toBe(true);
    expect(outsideFollowZone({ x: -20, y: 250 }, pane)).toBe(true);
  });
});

describe("following a peer", () => {
  it("stops when that peer leaves, not when another does", () => {
    const store = createCollabStore();
    const user = (id: string) => ({ id, name: id, color: "#000" });
    store.getState().setSession({
      roomId: "r",
      isHost: true,
      localUser: user("me"),
      status: "connected",
      peers: ["ana", "bia"].map((id) => ({
        clientId: id,
        user: user(id),
        cursor: null,
        activeElementId: null,
      })),
    });
    store.getState().setFollowing("ana");
    store.getState().removePeer("bia");
    expect(store.getState().following).toBe("ana");
    store.getState().removePeer("ana");
    expect(store.getState().following).toBeNull();
  });
});
