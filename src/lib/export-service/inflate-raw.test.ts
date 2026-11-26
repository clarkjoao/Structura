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

  it("throws on garbage instead of looping", () => {
    expect(() => inflateRaw(new Uint8Array([0xff, 0xff, 0xff]))).toThrow();
  });
});
