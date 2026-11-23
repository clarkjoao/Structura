import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadFile } from "./download-file";

describe("downloadFile", () => {
  const createObjectURL = vi.fn((_blob: Blob) => "blob:mock");
  const revokeObjectURL = vi.fn();
  let clicked: { download: string; connected: boolean; blob: Blob | undefined } | null;

  beforeEach(() => {
    vi.useFakeTimers();
    clicked = null;
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked = {
        download: this.download,
        connected: this.isConnected,
        blob: createObjectURL.mock.lastCall?.[0],
      };
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
  });

  it("keeps the filename and extension on a late Blob download (GIF)", () => {
    downloadFile(new Blob(["GIF89a"]), "checkout.gif", "image/gif");

    expect(clicked?.download).toBe("checkout.gif");
    expect(clicked?.connected).toBe(true);
    expect(clicked?.blob?.type).toBe("image/gif");
  });

  it("revokes the object URL only after the download has started", () => {
    downloadFile("{}", "diagram.json", "application/json");

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("removes the temporary anchor from the document", () => {
    downloadFile("{}", "diagram.json", "application/json");
    expect(document.querySelectorAll("a[download]")).toHaveLength(0);
  });
});
