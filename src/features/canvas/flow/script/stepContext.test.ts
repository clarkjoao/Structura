import { describe, expect, it } from "vitest";
import { parseJsonField, setsFromPayload, valuesFromPaste } from "./stepContext";

/**
 * Reading text the author already has into the object.
 *
 * These used to sit behind an editor inside every step, parsing `key: value`
 * text on each keystroke and formatting it back — which turned `score: 0.12`
 * into a key `s` holding `core:0.12`. Nothing parses while anyone types now;
 * these run only on a paste or on a body someone already wrote.
 */

describe("a body read as the values it introduces", () => {
  it("takes the top-level keys of an object", () => {
    expect(setsFromPayload('{ "slug": "artigo26", "ttl": 86400 }')).toEqual({
      slug: "artigo26",
      ttl: "86400",
    });
  });

  it("keeps anything deeper as the shape it is", () => {
    expect(setsFromPayload('{ "user": { "id": 3 } }')).toEqual({ user: '{"id":3}' });
  });

  it("has nothing to offer for prose, an array, or an empty body", () => {
    expect(setsFromPayload("uma nota sobre o passo")).toBeUndefined();
    expect(setsFromPayload("[1, 2]")).toBeUndefined();
    expect(setsFromPayload("{}")).toBeUndefined();
    expect(setsFromPayload(undefined)).toBeUndefined();
  });

  it("never throws on a body that is half typed", () => {
    expect(setsFromPayload('{ "slug": ')).toBeUndefined();
  });
});

describe("text pasted into a key field", () => {
  it("splits on the first colon, so a URL survives", () => {
    expect(valuesFromPaste("slug: artigo26\nurl: https://url.sh/x")).toEqual({
      slug: "artigo26",
      url: "https://url.sh/x",
    });
  });

  it("reads an object as its top-level keys", () => {
    expect(valuesFromPaste('{ "a": 1, "b": { "c": 2 } }')).toEqual({ a: "1", b: '{"c":2}' });
  });

  it("leaves a single line to fill the field it was pasted into", () => {
    expect(valuesFromPaste("https://url.sh/x")).toBeNull();
    expect(valuesFromPaste("slug: artigo26")).toBeNull();
  });

  it("leaves text that is not shaped like values alone", () => {
    expect(valuesFromPaste("uma nota\nsobre o passo")).toBeNull();
    expect(valuesFromPaste("   ")).toBeNull();
  });
});

describe("a field read as JSON", () => {
  it("parses what is JSON and reports what is not", () => {
    expect(parseJsonField('{ "a": 1 }')).toEqual({ a: 1 });
    expect(parseJsonField("nada disso")).toBeNull();
    expect(parseJsonField("   ")).toBeNull();
  });
});
