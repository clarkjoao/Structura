import { beforeEach, describe, expect, it } from "vitest";
import {
  isFavoriteDiagram,
  readFavoriteIds,
  toggleFavoriteDiagram,
  writeFavoriteIds,
} from "./favoriteDiagrams";

describe("favoriteDiagrams", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty", () => {
    expect(readFavoriteIds()).toEqual([]);
  });

  it("toggles an id on and off", () => {
    expect(toggleFavoriteDiagram("d1")).toEqual(["d1"]);
    expect(isFavoriteDiagram("d1")).toBe(true);
    expect(toggleFavoriteDiagram("d1")).toEqual([]);
    expect(isFavoriteDiagram("d1")).toBe(false);
  });

  it("keeps stable unique order (newest first)", () => {
    toggleFavoriteDiagram("a");
    toggleFavoriteDiagram("b");
    expect(readFavoriteIds()).toEqual(["b", "a"]);
    writeFavoriteIds(["a", "a", "b"]);
    expect(readFavoriteIds()).toEqual(["a", "b"]);
  });
});
