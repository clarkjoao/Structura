import { afterEach, describe, expect, it, vi } from "vitest";
import { readStructuraClipboard, writeDrawioToClipboard } from "./clipboard-utils";
import type { ClipboardEntry } from "@/features/diagram/store/store.types";
import type { AwsComponent } from "@/features/diagram/model/component.types";

const STRUCTURA_CUSTOM_FORMAT = "web application/x-structura-clipboard+json";

class FakeClipboardItem {
  private readonly blobs: Record<string, Blob>;

  static supports(_type: string): boolean {
    return true;
  }

  constructor(items: Record<string, Blob>) {
    this.blobs = items;
  }

  get types(): string[] {
    return Object.keys(this.blobs);
  }

  async getType(type: string): Promise<Blob> {
    const blob = this.blobs[type];
    if (!blob) throw new Error(`no blob for type ${type}`);
    return blob;
  }
}

function stubClipboard(overrides: {
  write?: (items: unknown[]) => Promise<void>;
  read?: () => Promise<unknown[]>;
  supportsCustomFormat?: boolean;
}): void {
  class Item extends FakeClipboardItem {
    static override supports(type: string): boolean {
      if (overrides.supportsCustomFormat === false && type.startsWith("web ")) return false;
      return true;
    }
  }
  vi.stubGlobal("ClipboardItem", Item);
  vi.stubGlobal("navigator", {
    ...navigator,
    clipboard: {
      write: overrides.write ?? vi.fn().mockResolvedValue(undefined),
      read: overrides.read ?? vi.fn().mockResolvedValue([]),
      readText: vi.fn().mockResolvedValue(""),
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const sampleDrawioXml =
  '<mxfile><diagram><mxGraphModel><root><mxCell id="1"/></root></mxGraphModel></diagram></mxfile>';

const awsComponent: AwsComponent = {
  id: "el_1",
  name: "ECS Cluster",
  description: "",
  parentId: null,
  type: "ecs-cluster" as AwsComponent["type"],
  awsService: "ecs-cluster",
  customColor: "#ff69b4",
  customIconId: "icon_pink_ecs",
};

const sampleEntry: ClipboardEntry = {
  components: [awsComponent],
  connections: [],
  relativeOffsets: [{ dx: 0, dy: 0 }],
};

describe("writeDrawioToClipboard", () => {
  it("never modifies the text/plain or text/html payloads real draw.io parses", async () => {
    // Regression: an earlier version embedded a hidden marker div inside the
    // text/html blob. Real draw.io's paste importer only recognizes its own
    // exact html shape and fell back to importing the raw XML as literal text
    // shapes when that shape was altered. text/plain and text/html must stay
    // byte-for-byte what they'd be without any Structura payload at all.
    let withEntry: FakeClipboardItem | null = null;
    let withoutEntry: FakeClipboardItem | null = null;

    stubClipboard({
      write: async (items) => {
        withEntry = items[0] as FakeClipboardItem;
      },
    });
    await writeDrawioToClipboard(sampleDrawioXml, sampleEntry);

    stubClipboard({
      write: async (items) => {
        withoutEntry = items[0] as FakeClipboardItem;
      },
    });
    await writeDrawioToClipboard(sampleDrawioXml);

    const plainWith = await (await withEntry!.getType("text/plain")).text();
    const plainWithout = await (await withoutEntry!.getType("text/plain")).text();
    const htmlWith = await (await withEntry!.getType("text/html")).text();
    const htmlWithout = await (await withoutEntry!.getType("text/html")).text();

    expect(plainWith).toBe(plainWithout);
    expect(htmlWith).toBe(htmlWithout);
    expect(htmlWith).not.toContain("structura");
  });

  it("adds the Structura payload only as a separate custom clipboard format", async () => {
    let written: FakeClipboardItem | null = null;
    stubClipboard({
      write: async (items) => {
        written = items[0] as FakeClipboardItem;
      },
    });

    await writeDrawioToClipboard(sampleDrawioXml, sampleEntry);

    expect(written!.types).toEqual(
      expect.arrayContaining(["text/plain", "text/html", STRUCTURA_CUSTOM_FORMAT]),
    );
  });

  it("skips the custom format entirely when the browser doesn't support it", async () => {
    let written: FakeClipboardItem | null = null;
    stubClipboard({
      write: async (items) => {
        written = items[0] as FakeClipboardItem;
      },
      supportsCustomFormat: false,
    });

    await writeDrawioToClipboard(sampleDrawioXml, sampleEntry);

    expect(written!.types).not.toContain(STRUCTURA_CUSTOM_FORMAT);
    expect(written!.types).toEqual(expect.arrayContaining(["text/plain", "text/html"]));
  });
});

describe("writeDrawioToClipboard + readStructuraClipboard round-trip", () => {
  it("writes a full-fidelity ClipboardEntry that reads back identically", async () => {
    let written: FakeClipboardItem | null = null;
    stubClipboard({
      write: async (items) => {
        written = items[0] as FakeClipboardItem;
      },
    });

    await writeDrawioToClipboard(sampleDrawioXml, sampleEntry);
    expect(written).not.toBeNull();

    stubClipboard({ read: async () => [written] });

    const result = await readStructuraClipboard();
    expect(result).toEqual(sampleEntry);
  });

  it("round-trips non-ASCII characters (accents, emoji) in component names", async () => {
    let written: FakeClipboardItem | null = null;
    stubClipboard({
      write: async (items) => {
        written = items[0] as FakeClipboardItem;
      },
    });

    const entry: ClipboardEntry = {
      components: [{ ...awsComponent, name: "Núcleo de Serviços 🚀" }],
      connections: [],
    };
    await writeDrawioToClipboard(sampleDrawioXml, entry);

    stubClipboard({ read: async () => [written] });
    const result = await readStructuraClipboard();
    expect(result?.components[0].name).toBe("Núcleo de Serviços 🚀");
  });

  it("returns null for genuinely external draw.io content (no custom format present)", async () => {
    stubClipboard({
      read: async () => [
        new FakeClipboardItem({
          "text/plain": new Blob([sampleDrawioXml], { type: "text/plain" }),
          "text/html": new Blob(
            [`<meta charset="utf-8"><div data-type="text/plain">${sampleDrawioXml}</div>`],
            { type: "text/html" },
          ),
        }),
      ],
    });

    const result = await readStructuraClipboard();
    expect(result).toBeNull();
  });

  it("returns null when no ClipboardEntry was passed on write", async () => {
    let written: FakeClipboardItem | null = null;
    stubClipboard({
      write: async (items) => {
        written = items[0] as FakeClipboardItem;
      },
    });

    await writeDrawioToClipboard(sampleDrawioXml);
    stubClipboard({ read: async () => [written] });

    const result = await readStructuraClipboard();
    expect(result).toBeNull();
  });
});
