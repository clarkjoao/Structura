import { afterEach, describe, expect, it } from "vitest";
import { clearAllPreviews, setPreview } from "./previewCache";

describe("previewCache", () => {
  afterEach(() => {
    clearAllPreviews();
  });

  it("stores each diagram under its own key", () => {
    setPreview("a", "<svg>a</svg>");
    setPreview("b", "<svg>b</svg>");
    expect(localStorage.getItem("structura_diagram-preview:a")).toBe("<svg>a</svg>");
    expect(localStorage.getItem("structura_diagram-preview:b")).toBe("<svg>b</svg>");
  });
});
