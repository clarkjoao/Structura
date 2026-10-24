import { describe, expect, it } from "vitest";
import { filterItems, foldText, scoreItem } from "./palette.search";
import type { PaletteItem } from "./palette.types";

const item = (
  id: string,
  label: string,
  extra: Partial<PaletteItem<string>> = {},
): PaletteItem<string> => ({
  id,
  label,
  groupIds: ["g"],
  payload: id,
  ...extra,
});

describe("foldText", () => {
  it("drops accents and case", () => {
    expect(foldText("Orquestração PIX")).toBe("orquestracao pix");
  });
});

describe("scoreItem", () => {
  it("is zero when any word misses everywhere", () => {
    expect(scoreItem(item("a", "Checkout"), "checkout zebra", "")).toBe(0);
  });

  it("ranks a title prefix over a title substring over other fields", () => {
    const prefix = scoreItem(item("a", "Checkout API"), "check", "");
    const word = scoreItem(item("b", "Order checkout"), "check", "");
    const inner = scoreItem(item("c", "Precheckout"), "check", "");
    const other = scoreItem(item("d", "Orders", { description: "the checkout flow" }), "check", "");
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(inner);
    expect(inner).toBeGreaterThan(other);
    expect(other).toBeGreaterThan(0);
  });

  it("matches the group label and keywords", () => {
    expect(scoreItem(item("a", "Hub"), "vendas", "Vendas")).toBeGreaterThan(0);
    expect(scoreItem(item("a", "Hub", { keywords: ["psp"] }), "psp", "")).toBeGreaterThan(0);
  });
});

describe("filterItems", () => {
  const items = [item("1", "Ledger"), item("2", "Hub Pix"), item("3", "Pix Ledger")];

  it("returns everything, in order, for an empty query", () => {
    expect(filterItems(items, "  ", () => "").map((i) => i.id)).toEqual(["1", "2", "3"]);
  });

  it("orders by score, then by the original order", () => {
    expect(filterItems(items, "pix", () => "").map((i) => i.id)).toEqual(["3", "2"]);
  });
});
