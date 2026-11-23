import { describe, expect, it } from "vitest";
import { registerBuiltInDiagramKinds } from "./bootstrap";
registerBuiltInDiagramKinds();
import { kindTextCaptureFor } from "./textCapture";

describe("kindTextCaptureFor", () => {
  it("is the guided outline while the diagram is edited as guided", () => {
    expect(kindTextCaptureFor({ kind: "guided" })).not.toBeNull();
  });

  it("is nothing on a freehand diagram or a guided diagram edited freehand", () => {
    expect(kindTextCaptureFor({})).toBeNull();
    expect(kindTextCaptureFor({ kind: "guided", kindMode: "freehand" })).toBeNull();
    expect(kindTextCaptureFor(null)).toBeNull();
  });
});
