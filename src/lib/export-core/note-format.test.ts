import { describe, expect, it } from "vitest";
import { estimateNoteHeight, renderNoteHtml } from "./note-format";

describe("renderNoteHtml", () => {
  it("renders headers at descending sizes", () => {
    expect(renderNoteHtml("# Big")).toBe('<b style="font-size:18px">Big</b>');
    expect(renderNoteHtml("## Mid")).toBe('<b style="font-size:15px">Mid</b>');
    expect(renderNoteHtml("### Small")).toBe('<b style="font-size:13px">Small</b>');
  });

  it("renders bold, italic and bullet lists", () => {
    expect(renderNoteHtml("**b**")).toBe("<b>b</b>");
    expect(renderNoteHtml("_i_")).toBe("<i>i</i>");
    expect(renderNoteHtml("- item")).toBe("• item");
  });

  it("joins lines with <br> and leaves plain text alone", () => {
    expect(renderNoteHtml("a\nb")).toBe("a<br>b");
    expect(renderNoteHtml("plain text")).toBe("plain text");
  });

  it("does not turn a lone asterisk into italics", () => {
    expect(renderNoteHtml("2 * 3 = 6")).toBe("2 * 3 = 6");
  });
});

describe("estimateNoteHeight", () => {
  it("is compact for short content (not the fixed 475)", () => {
    expect(estimateNoteHeight("hello", 336)).toBe(48);
    expect(estimateNoteHeight("hello", 336)).toBeLessThan(475);
  });

  it("grows with more lines so long notes are not clipped", () => {
    const short = estimateNoteHeight("one line", 336);
    const long = estimateNoteHeight(Array.from({ length: 20 }, () => "a line").join("\n"), 336);
    expect(long).toBeGreaterThan(short);
    expect(long).toBeGreaterThan(400);
  });

  it("accounts for wrapping on narrow widths", () => {
    const wide = estimateNoteHeight("a".repeat(90), 336);
    const narrow = estimateNoteHeight("a".repeat(90), 120);
    expect(narrow).toBeGreaterThan(wide);
  });
});
