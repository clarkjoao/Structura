import { afterEach, describe, expect, it, vi } from "vitest";
import { readStructuraClipboard, writeDrawioToClipboard } from "./clipboard-utils";
import type { ClipboardEntry } from "@/features/diagram/store/store.types";
import type { AwsComponent } from "@/features/diagram/model/component.types";

class FakeClipboardItem {
  private readonly blobs: Record<string, Blob>;

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
}): void {
  vi.stubGlobal("ClipboardItem", FakeClipboardItem);
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

describe("writeDrawioToClipboard + readStructuraClipboard round-trip", () => {
  it("embeds a full-fidelity ClipboardEntry that reads back identically", async () => {
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

  it("returns null when the OS clipboard has no Structura marker (real draw.io content)", async () => {
    stubClipboard({
      // No text/structura marker at all — only draw.io's own text/html shape.
      read: async () => [
        new FakeClipboardItem({
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

  it("does not embed a marker when no ClipboardEntry is passed", async () => {
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
