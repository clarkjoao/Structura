import { afterEach, describe, expect, it } from "vitest";
import { clearAllPreviews, deletePreview, getPreview, setPreview } from "./previewCache";

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

  it("keeps the dark variant under its own key and deletes both together", () => {
    setPreview("a", "<svg>light</svg>");
    setPreview("a", "<svg>dark</svg>", "dark");
    expect(getPreview("a")).toBe("<svg>light</svg>");
    expect(getPreview("a", "dark")).toBe("<svg>dark</svg>");
    deletePreview("a");
    expect(getPreview("a")).toBeNull();
    expect(getPreview("a", "dark")).toBeNull();
  });
});
