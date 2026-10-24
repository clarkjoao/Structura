import { describe, expect, it } from "vitest";
import type { Component, PanelComponent } from "./component.types";
import { domainColor, elementDomain, resolveBoundaryAppearance, DOMAIN_PALETTE } from "./boundary";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import { PanelKind } from "../enums";

const panel = (id: string, extra: Partial<PanelComponent> = {}): PanelComponent =>
  ({ id, name: id, type: "panel", description: "", parentId: null, ...extra }) as PanelComponent;

const map = (...components: Component[]) => Object.fromEntries(components.map((c) => [c.id, c]));

describe("elementDomain (D1: the domain is the group an element is in)", () => {
  it("is the parent group's name", () => {
    const vendas = panel("Vendas");
    const quantum = panel("Q", { parentId: "Vendas" });
    expect(elementDomain(quantum, map(vendas, quantum))).toEqual({ id: "Vendas", name: "Vendas" });
  });

  it("is null at the top level, or inside something that is not a group", () => {
    const top = panel("Top");
    expect(elementDomain(top, map(top))).toBeNull();
    const system = {
      id: "S",
      name: "S",
      type: "system",
      description: "",
      parentId: null,
    } as Component;
    const child = panel("C", { parentId: "S" });
    expect(elementDomain(child, map(system, child))).toBeNull();
  });

  it("is null for an unnamed group, rather than an empty domain", () => {
    const anon = panel("A", { name: "  " });
    const child = panel("C", { parentId: "A" });
    expect(elementDomain(child, map(anon, child))).toBeNull();
  });
});

describe("domainColor", () => {
  it("is stable and case- and accent-insensitive", () => {
    expect(domainColor("Vendas")).toBe(domainColor("  vendas "));
    expect(domainColor("Orquestração")).toBe(domainColor("orquestracao"));
  });

  it("comes from the palette", () => {
    for (const name of ["Vendas", "Pagamentos", "Risco", "Catálogo", "x"]) {
      expect(DOMAIN_PALETTE).toContain(domainColor(name));
    }
  });
});

describe("resolveBoundaryAppearance", () => {
  it("derives nothing for a panel with no type, or for a swimlane", () => {
    expect(resolveBoundaryAppearance(panel("P"), {})).toBeNull();
    expect(
      resolveBoundaryAppearance(
        panel("L", { boundaryType: "quantum", panelKind: PanelKind.Swimlane }),
        {},
      ),
    ).toBeNull();
  });

  it("takes the type's colour and outline at the top level", () => {
    const quantum = panel("Q", { boundaryType: "quantum" });
    const network = panel("N", { boundaryType: "network" });
    expect(resolveBoundaryAppearance(quantum, map(quantum))).toMatchObject({
      colorSource: "type",
      borderStyle: "solid",
    });
    expect(resolveBoundaryAppearance(network, map(network))).toMatchObject({
      borderStyle: "dashed",
    });
  });

  it("takes the domain's colour inside a group, with the type's outline", () => {
    const vendas = panel("Vendas");
    const net = panel("N", { boundaryType: "network", parentId: "Vendas" });
    expect(resolveBoundaryAppearance(net, map(vendas, net))).toEqual({
      color: domainColor("Vendas"),
      borderStyle: "dashed",
      colorSource: "domain",
      borderSource: "type",
    });
  });

  it("two boundaries in the same domain share a colour", () => {
    const vendas = panel("Vendas");
    const a = panel("A", { boundaryType: "quantum", parentId: "Vendas" });
    const b = panel("B", { boundaryType: "system", parentId: "Vendas" });
    const all = map(vendas, a, b);
    expect(resolveBoundaryAppearance(a, all)?.color).toBe(resolveBoundaryAppearance(b, all)?.color);
  });

  it("keeps a colour the author picked, and an outline they set", () => {
    const vendas = panel("Vendas");
    const q = panel("Q", {
      boundaryType: "quantum",
      parentId: "Vendas",
      panelColor: "#123456",
      borderStyle: "dotted",
    });
    expect(resolveBoundaryAppearance(q, map(vendas, q))).toMatchObject({
      color: "#123456",
      borderStyle: "dotted",
      colorSource: "custom",
      borderSource: "custom",
    });
  });

  it("a panel colour equal to its kind's default is not a custom colour", () => {
    const kindDefault = getPanelKindDef(undefined).defaultColor;
    const q = panel("Q", { boundaryType: "system", panelColor: kindDefault });
    expect(resolveBoundaryAppearance(q, map(q))?.colorSource).toBe("type");
  });
});
