import { describe, expect, it } from "vitest";
import type { Component, Connection } from "../model/diagram.types";
import { domainColor } from "../model/boundary";
import { buildLegend, isLegendEmpty } from "./legend";

const panel = (id: string, extra: Record<string, unknown> = {}): Component =>
  ({
    id,
    name: id,
    type: "panel",
    description: "",
    parentId: null,
    ...extra,
  }) as unknown as Component;
const all = (...cs: Component[]) => Object.fromEntries(cs.map((c) => [c.id, c]));
const ids = (...cs: Component[]) => new Set(cs.map((c) => c.id));
const conn = (id: string, extra: Partial<Connection> = {}): Connection =>
  ({ id, sourceId: "a", targetId: "b", label: "", ...extra }) as Connection;

describe("buildLegend", () => {
  it("is empty for a diagram that uses none of it", () => {
    const p = panel("P");
    expect(isLegendEmpty(buildLegend(all(p), ids(p), []))).toBe(true);
  });

  it("lists the boundary types in use, in a fixed order, with their outline", () => {
    const net = panel("N", { boundaryType: "network" });
    const q = panel("Q", { boundaryType: "quantum" });
    const legend = buildLegend(all(net, q), ids(net, q), []);
    expect(legend.boundaryTypes).toEqual([
      { type: "quantum", borderStyle: "solid" },
      { type: "network", borderStyle: "dashed" },
    ]);
  });

  it("lists the domains that colour a boundary, once each, with the colour", () => {
    const vendas = panel("Vendas");
    const a = panel("A", { boundaryType: "quantum", parentId: "Vendas" });
    const b = panel("B", { boundaryType: "system", parentId: "Vendas" });
    const legend = buildLegend(all(vendas, a, b), ids(vendas, a, b), []);
    expect(legend.domains).toEqual([{ name: "Vendas", color: domainColor("Vendas") }]);
  });

  it("does not list a domain for a boundary whose colour was picked", () => {
    const vendas = panel("Vendas");
    const a = panel("A", { boundaryType: "quantum", parentId: "Vendas", panelColor: "#123456" });
    expect(buildLegend(all(vendas, a), ids(vendas, a), []).domains).toEqual([]);
  });

  it("leaves out what is not shown", () => {
    const q = panel("Q", { boundaryType: "quantum" });
    expect(buildLegend(all(q), new Set(), []).boundaryTypes).toEqual([]);
  });

  it("lists the interactions in use: sync solid first, then async", () => {
    const legend = buildLegend({}, new Set(), [
      conn("1", { interaction: "async" }),
      conn("2", { interaction: "sync" }),
    ]);
    expect(legend.interactions).toEqual(["sync", "async"]);
  });

  it("reads a pre-migration connection through its intent", () => {
    expect(buildLegend({}, new Set(), [conn("1", { intent: "event" })]).interactions).toEqual([
      "async",
    ]);
  });

  it("a plain connection is synchronous", () => {
    expect(buildLegend({}, new Set(), [conn("1")]).interactions).toEqual(["sync"]);
  });

  it("follows the diagram: the last asynchronous connection going takes async with it", () => {
    const withAsync = buildLegend({}, new Set(), [conn("1"), conn("2", { interaction: "async" })]);
    const without = buildLegend({}, new Set(), [conn("1")]);
    expect(withAsync.interactions).toContain("async");
    expect(without.interactions).not.toContain("async");
  });
});
