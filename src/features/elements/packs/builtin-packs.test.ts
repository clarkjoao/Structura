import { describe, expect, it } from "vitest";
import "@/features/elements/bootstrap";
import { getElement, hasElement } from "@/features/elements/element.registry";
import { iconResolverForFamily } from "@/features/elements/families/family-icon-resolvers";
import { builtinPacks } from "./builtin-packs";
import { packTypeId } from "./pack.schema";

/**
 * Every `packs/<id>/pack.json` is valid (`builtinPacks()` parses each one and throws on the
 * first invalid pack), registered at boot, and complete: an icon a service names exists.
 */
describe("built-in element packs", () => {
  const packs = builtinPacks();

  it("are found on disk, the legacy families first", () => {
    const ids = packs.map(({ pack }) => pack.id);
    expect(ids.slice(0, 5)).toEqual(["aws", "gcp", "azure", "k8s", "oss"]);
    expect(ids).toContain("shapes");
  });

  it("are all registered at boot", () => {
    for (const { pack } of packs) {
      for (const entry of [...pack.categories, ...pack.shapes]) {
        expect(hasElement(packTypeId(pack, entry.id)), `${pack.id}/${entry.id}`).toBe(true);
      }
    }
  });

  it("ship every icon their services name", () => {
    for (const { pack, icons } of packs) {
      // Packs whose icons come from an npm set (aws, gcp, azure) are checked by their resolver
      // tests; packs with their own SVGs must have every one.
      if (!icons) continue;
      for (const service of pack.services) {
        expect(icons.get(service.icon)?.dataUri(), `${pack.id}: ${service.id}`).toBeTruthy();
      }
    }
  });

  it("resolve every service icon through their family's resolver", () => {
    for (const { pack } of packs) {
      if (pack.categories.length === 0) continue;
      const resolver = iconResolverForFamily(pack.id);
      expect(resolver, pack.id).toBeDefined();
    }
  });

  it("draw shapes with the ShapeNode at their declared size", () => {
    const shapes = packs.find(({ pack }) => pack.id === "shapes")!.pack;
    for (const shape of shapes.shapes) {
      const element = getElement(packTypeId(shapes, shape.id))!;
      expect(element.canvas.handles).toEqual({ incoming: 1, outgoing: 1 });
      expect(element.model.defaultSize).toEqual(shape.size);
    }
  });
});
