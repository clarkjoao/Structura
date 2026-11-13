import { describe, expect, it } from "vitest";
import { acceptsEmbedMessage, parseAllowedOrigins } from "./embedMessageGuard";

const self = { name: "viewer" } as unknown as Window;
const parent = { name: "embedding page" } as unknown as Window;
const other = { name: "another frame" } as unknown as Window;

describe("acceptsEmbedMessage (audit D4)", () => {
  it("takes the embedding page's message from any origin by default", () => {
    const ctx = { self, parent, allowedOrigins: [] };
    expect(acceptsEmbedMessage({ source: parent, origin: "https://docs.example.com" }, ctx)).toBe(
      true,
    );
    expect(acceptsEmbedMessage({ source: parent, origin: "null" }, ctx)).toBe(true);
  });

  it("refuses anything that is not the embedding page", () => {
    const ctx = { self, parent, allowedOrigins: [] };
    expect(acceptsEmbedMessage({ source: other, origin: "https://docs.example.com" }, ctx)).toBe(
      false,
    );
    expect(acceptsEmbedMessage({ source: null, origin: "https://docs.example.com" }, ctx)).toBe(
      false,
    );
  });

  it("refuses everything when the viewer is not in a frame", () => {
    const ctx = { self, parent: self, allowedOrigins: [] };
    expect(acceptsEmbedMessage({ source: self, origin: "https://structur.dev" }, ctx)).toBe(false);
  });

  it("closes the origin when a build lists the allowed ones", () => {
    const ctx = { self, parent, allowedOrigins: ["https://docs.example.com"] };
    expect(acceptsEmbedMessage({ source: parent, origin: "https://docs.example.com" }, ctx)).toBe(
      true,
    );
    expect(acceptsEmbedMessage({ source: parent, origin: "https://evil.example" }, ctx)).toBe(
      false,
    );
    expect(acceptsEmbedMessage({ source: parent, origin: "null" }, ctx)).toBe(false);
  });
});

describe("parseAllowedOrigins", () => {
  it("splits, trims and drops trailing slashes and blanks", () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
    expect(parseAllowedOrigins("")).toEqual([]);
    expect(parseAllowedOrigins(" https://a.example/ , ,https://b.example")).toEqual([
      "https://a.example",
      "https://b.example",
    ]);
  });
});
