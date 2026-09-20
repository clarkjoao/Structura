import { beforeEach, describe, expect, it } from "vitest";
import { readFavoriteIds, toggleFavoriteDiagram } from "@/pages/dashboard/favoriteDiagrams";
import {
  readFavoriteWalkthroughIds,
  toggleFavoriteWalkthrough,
  writeFavoriteWalkthroughIds,
} from "./favoriteWalkthroughs";

describe("favoriteWalkthroughs", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("reads back what was marked", async () => {
    await toggleFavoriteWalkthrough("wt_1");

    expect(await readFavoriteWalkthroughIds()).toEqual(["wt_1"]);
  });

  it("unmarks on a second toggle", async () => {
    await toggleFavoriteWalkthrough("wt_1");
    await toggleFavoriteWalkthrough("wt_1");

    expect(await readFavoriteWalkthroughIds()).toEqual([]);
  });

  it("puts the most recently marked first", async () => {
    await toggleFavoriteWalkthrough("wt_1");
    await toggleFavoriteWalkthrough("wt_2");

    expect(await readFavoriteWalkthroughIds()).toEqual(["wt_2", "wt_1"]);
  });

  it("never stores an id twice", async () => {
    await writeFavoriteWalkthroughIds(["wt_1", "wt_1", "wt_2"]);

    expect(await readFavoriteWalkthroughIds()).toEqual(["wt_1", "wt_2"]);
  });

  it("survives a corrupt stored value instead of throwing", async () => {
    localStorage.setItem("walkthrough_favorites", "not json");

    expect(await readFavoriteWalkthroughIds()).toEqual([]);
  });

  it("does not share a key with diagram favorites", async () => {
    toggleFavoriteDiagram("d-1");
    await toggleFavoriteWalkthrough("wt_1");

    expect(readFavoriteIds()).toEqual(["d-1"]);
    expect(await readFavoriteWalkthroughIds()).toEqual(["wt_1"]);
  });
});
