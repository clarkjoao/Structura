import { describe, expect, it } from "vitest";
import fixture from "./__fixtures__/observability/pack.json";
import { packTypeId, parsePack, toHslTriplet } from "./pack.schema";

const clone = (): Record<string, unknown> => JSON.parse(JSON.stringify(fixture));

describe("parsePack", () => {
  it("accepts a valid pack and fills its defaults", () => {
    const pack = parsePack(fixture);
    expect(pack.typeIds).toBe("namespaced");
    expect(pack.categories.map((category) => category.id)).toEqual(["metrics", "tracing"]);
    expect(packTypeId(pack, "metrics")).toBe("observability/metrics");
  });

  it("rejects a service whose category the pack does not declare, naming both", () => {
    const raw = clone();
    raw.services = [{ id: "loki", name: "Loki", category: "logs", icon: "loki" }];
    expect(() => parsePack(raw)).toThrow(/observability[\s\S]*loki[\s\S]*"logs"/);
  });

  it("rejects a label without pt-BR, naming the field path", () => {
    const raw = clone();
    raw.categories = [
      {
        id: "metrics",
        label: { en: "Metrics" },
        description: { en: "x", "pt-BR": "x" },
        accent: { light: "#000" },
      },
    ];
    raw.services = [];
    expect(() => parsePack(raw)).toThrow(/categories\.0\.label/);
  });

  it("rejects duplicate category ids and a pack with nothing in it", () => {
    const duplicate = clone();
    const [first] = fixture.categories;
    duplicate.categories = [first, first];
    expect(() => parsePack(duplicate)).toThrow(/is a duplicate/);

    expect(() => parsePack({ id: "empty", label: { en: "Empty", "pt-BR": "Vazio" } })).toThrow(
      /at least one category or shape/,
    );
  });

  it("reserves verbatim type ids for the legacy families", () => {
    const raw = clone();
    raw.typeIds = "verbatim";
    expect(() => parsePack(raw)).toThrow(/reserved/);
  });

  it("accepts only path data in a shape outline", () => {
    const raw = clone();
    raw.shapes = [
      {
        id: "evil",
        label: { en: "Evil", "pt-BR": "Mau" },
        viewBox: "0 0 10 10",
        paths: ['M0 0"/><script>alert(1)</script><path d="'],
      },
    ];
    expect(() => parsePack(raw)).toThrow(/path commands/);
  });

  it("converts hex accents to the triplet the CSS tokens use", () => {
    expect(toHslTriplet("#ff0000")).toBe("0 100% 50%");
    expect(toHslTriplet("30 100% 50%")).toBe("30 100% 50%");
  });
});
