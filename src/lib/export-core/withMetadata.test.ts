import { describe, expect, it } from "vitest";
import { withMetadata } from "./build";

describe("withMetadata", () => {
  const cell =
    '<mxCell id="n" value="Name" style="rounded=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="10" height="10" as="geometry"/></mxCell>';
  const rep = '<mxCell id="n-rep" value="" style="x;" vertex="1" parent="n"></mxCell>';

  it("leaves a cell alone without metadata", () => {
    expect(withMetadata(cell, undefined)).toBe(cell);
    expect(withMetadata(cell, {})).toBe(cell);
  });

  it("promotes a cell to an object carrying the attributes, and leaves the cells after it outside", () => {
    expect(withMetadata(cell + rep, { structuraRefOf: "a&b" })).toBe(
      '<object id="n" label="Name" structuraRefOf="a&amp;b"><mxCell style="rounded=1;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="10" height="10" as="geometry"/></mxCell></object>' +
        rep,
    );
  });

  it("adds to an object that already is one", () => {
    expect(
      withMetadata('<object c4Type="Container" id="n"><mxCell/></object>', {
        structuraShared: "badge",
      }),
    ).toBe('<object structuraShared="badge" c4Type="Container" id="n"><mxCell/></object>');
  });

  it("leaves anything else as it is", () => {
    expect(withMetadata("<mxCell/>", { structuraShared: "badge" })).toBe("<mxCell/>");
    expect(withMetadata('<mxCell id="n" value="x" style="">', { structuraShared: "badge" })).toBe(
      '<mxCell id="n" value="x" style="">',
    );
  });
});
