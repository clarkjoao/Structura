import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inflateRaw } from "./inflate-raw";

const roundTrip = (text: string, level: number): string =>
  Buffer.from(inflateRaw(deflateRawSync(Buffer.from(text), { level }))).toString();

describe("inflateRaw", () => {
  const long = Array.from({ length: 4000 }, (_, i) => `<mxCell id="${i}" value="n${i % 7}"/>`).join(
    "",
  );

  it.each([0, 1, 6, 9])("round-trips node's deflateRaw at level %i", (level) => {
    expect(roundTrip(long, level)).toBe(long);
    expect(roundTrip("", level)).toBe("");
    expect(roundTrip("a", level)).toBe("a");
  });

  it("stops a decompression bomb at the output limit", () => {
    // 4 MB of zeros deflates to a few KB; a 1 MB limit must refuse it.
    const bomb = deflateRawSync(Buffer.alloc(4 * 1024 * 1024), { level: 9 });
    expect(bomb.length).toBeLessThan(16 * 1024);
    expect(() => inflateRaw(bomb, 1024 * 1024)).toThrow(/size limit/);
    expect(inflateRaw(bomb, 4 * 1024 * 1024)).toHaveLength(4 * 1024 * 1024);
  });

  it("throws on garbage instead of looping", () => {
    expect(() => inflateRaw(new Uint8Array([0xff, 0xff, 0xff]))).toThrow();
  });
});
