import { describe, expect, it, vi } from "vitest";
import LZString from "lz-string";
import type { Diagram } from "@/features/diagram";
import { fixture, jsonFixture } from "@/lib/export-service/__fixtures__/load";
import { MAX_SHARE_PAYLOAD_CHARS } from "./decode";
import { decodeShareParam, decodeSharePayload, generateShareUrl } from "./index";

/** Committed share-link fixtures (src/lib/export-service/__fixtures__/share). */
const line = (name: string) => fixture(`share/${name}`).trim();
/** What `getShareParamFromUrl` returns for a hash: one layer of percent-decoding. */
const paramOfHash = (hash: string) => new URLSearchParams(hash).get("share")!;

const hostileSvg = (d: Diagram | null) => {
  const logo = d?.snapshot.components.logo as { svgContent?: string } | undefined;
  return logo?.svgContent ?? "";
};

describe("share-link fixtures", () => {
  it("decodes a plain link", () => {
    const d = decodeShareParam(line("share-simple.txt"));
    expect(d?.snapshot.components.api?.name).toBe("API");
  });

  // 35f1dda8: the payload alphabet contains `+`; a raw `+` in a hash reads back as a space.
  // Special characters in names must come out the other side untouched.
  it("special characters and unicode survive the percent-encoded hash", () => {
    const hash = line("share-special-chars.txt");
    expect(hash.startsWith("share=")).toBe(true);
    const d = decodeShareParam(paramOfHash(hash));
    expect(d?.name).toBe("Q&A #1 100% a+b?c=d/é 日本語 🚀");
    expect(d?.snapshot.components.s).toMatchObject({
      name: "Café ☕ <b>&amp; \"quotes\" 'x'",
      description: "50% + 50% = 100%; a&b#c?d",
    });
  });

  // 35f1dda8: generateShareUrl encodes the compressed payload, so the hash never carries a raw
  // `+` or `%` that the reader would misread.
  it("a freshly generated link has no raw '+' in the hash and round-trips", () => {
    const original = decodeShareParam(paramOfHash(line("share-special-chars.txt")))!;
    const { url } = generateShareUrl(original);
    const hash = url.split("#")[1]!;
    expect(hash).not.toMatch(/\+/);
    expect(decodeShareParam(paramOfHash(hash))).toEqual(original);
  });

  it("reads a legacy base64 link", () => {
    const d = decodeShareParam(line("share-legacy-base64.txt"));
    expect(d?.snapshot.components.db?.name).toBe("Database");
  });

  // ac72766c: share links are validated and capped.
  it("rejects a link longer than the cap without decompressing it", () => {
    const spy = vi.spyOn(LZString, "decompressFromEncodedURIComponent");
    expect(decodeSharePayload("A".repeat(MAX_SHARE_PAYLOAD_CHARS + 1))).toBeNull();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("rejects a small link that decompresses past the cap, even when it is a valid diagram", () => {
    const valid = decodeShareParam(line("share-simple.txt"))!;
    const padded = { ...valid, description: "a".repeat(MAX_SHARE_PAYLOAD_CHARS + 10) };
    const huge = LZString.compressToEncodedURIComponent(JSON.stringify(padded));
    expect(huge.length).toBeLessThan(MAX_SHARE_PAYLOAD_CHARS);
    expect(decodeSharePayload(huge)).toBeNull();
    // Control: the same diagram under the cap decodes.
    const small = LZString.compressToEncodedURIComponent(
      JSON.stringify({ ...valid, description: "ok" }),
    );
    expect(decodeSharePayload(small)?.diagram.id).toBe(valid.id);
  });

  it("rejects a payload that is JSON but not a diagram", () => {
    const notDiagram = LZString.compressToEncodedURIComponent(JSON.stringify({ hello: "world" }));
    expect(decodeSharePayload(notDiagram)).toBeNull();
  });

  // ac72766c: sanitize user SVG at every import path (link).
  it("sanitizes <script> and on* attributes in a hostile link", () => {
    const hash = line("share-hostile-svg.txt");
    const d = decodeShareParam(hash);
    const svg = hostileSvg(d);
    expect(svg).toContain("<rect");
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son\w+\s*=/i);
  });

  it("the fixture really is hostile before decoding", () => {
    const raw = JSON.parse(
      LZString.decompressFromEncodedURIComponent(line("share-hostile-svg.txt")),
    ) as Diagram;
    expect(hostileSvg(raw)).toMatch(/<script/);
    expect(jsonFixture("workspace/diagram-hostile-svg.json")).toBeTruthy();
  });
});
