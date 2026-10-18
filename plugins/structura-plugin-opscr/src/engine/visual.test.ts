/**
 * The visual layer through the binding engine: an opscr workspace imported from draw.io is drawn
 * with its boundaries, sidecar services, text and chains; canvas edits of them reach
 * `opscr.visual.json` and nothing else.
 */
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it } from "vitest";
import { importDrawio } from "opscr/import-drawio";
import { LAYOUT_FILE, VISUAL_FILE, parseVisualFile } from "../generated/opscr-mapping";
import { projectWorkspace } from "../project";
import type { SourceText } from "./patches";
import { emptyBinding, type BindingState } from "./sync";
import { OpscrEngine, type EngineEvent } from "./engine";
import { FakeCanvas } from "./fake-canvas.fixture";

const DRAWING = "node_modules/opscr/tests/import/corpus/vendor/aws/example-microservices.drawio";

async function importedFiles(path: string): Promise<SourceText[]> {
  const files = await importDrawio(readFileSync(path, "utf8"), {
    source: "example-microservices.drawio",
  });
  return files.filter((f) => !f.path.includes("/")).map((f) => ({ name: f.path, text: f.content }));
}

class Session {
  canvas = new FakeCanvas();
  binding: BindingState = emptyBinding();
  events: EngineEvent[] = [];
  constructor(public files: SourceText[]) {}
  text = (name: string) => this.files.find((f) => f.name === name)?.text;
  engine = new OpscrEngine({
    texts: {
      get: () => this.files,
      set: (files) => {
        for (const file of files) {
          const i = this.files.findIndex((f) => f.name === file.name);
          if (i >= 0) this.files[i] = { ...file };
          else this.files.push({ ...file });
        }
      },
    },
    diagram: { get: () => this.canvas.snapshot(), apply: (changes) => this.canvas.apply(changes) },
    binding: { get: () => this.binding, set: (state) => void (this.binding = state) },
    project: (manifests, _config, previous) =>
      projectWorkspace(
        manifests.map((f) => ({ path: f.name, content: f.text })),
        undefined,
        previous,
      ),
    isManifest: (name) => name.endsWith(".opscr.yaml"),
    configFile: "opscr.config.yaml",
    onEvent: (event) => void this.events.push(event),
  });
  byLabel = (label: string) => this.canvas.components.find((c) => c.label === label);
  manifestTexts = () =>
    this.files
      .filter((f) => f.name.endsWith(".opscr.yaml") || f.name === LAYOUT_FILE)
      .map((f) => f.text);
}

let s: Session;
beforeEach(async () => {
  s = new Session(await importedFiles(DRAWING));
  await s.engine.sync();
});

describe("binding an imported folder", () => {
  it("draws boundaries, sidecar services and text", () => {
    expect(s.byLabel("AWS Cloud")).toMatchObject({ type: "panel" });
    expect(s.byLabel("Region: us-east-1")).toMatchObject({ type: "panel" });
    expect(
      s.canvas.components.filter(
        (c) => c.cloudServiceId === "cloudwatch" || c.cloudServiceId === "xray",
      ),
    ).toHaveLength(2);
    expect(s.byLabel("Microservices on ECS Fargate")).toMatchObject({ type: "text" });
    const region = s.byLabel("Region: us-east-1")!;
    expect(
      s.canvas.components.some((c) => c.parentId === region.id && c.type.startsWith("aws-")),
    ).toBe(true);
  });

  it("draws the CDN chain instead of the collapsed edge, and says so", () => {
    const users = s.byLabel("users")!;
    const direct = s.canvas.connections.filter((c) => c.sourceId === users.id);
    expect(direct).toHaveLength(1);
    expect(s.canvas.components.find((c) => c.id === direct[0]!.targetId)?.type).toBe(
      "aws-networking",
    );
    const through = s.events.find(
      (e): e is Extract<EngineEvent, { type: "drawn-through" }> => e.type === "drawn-through",
    );
    expect(through?.edges.map((e) => e.edge)).toEqual([
      "Channel/users -calls-> LoadBalancer/path-routing",
    ]);
  });

  it("a second sync changes nothing", async () => {
    const components = structuredClone(s.canvas.components);
    const connections = structuredClone(s.canvas.connections);
    const files = structuredClone(s.files);
    await s.engine.sync();
    for (const f of s.files)
      expect(f.text, f.name).toBe(files.find((x) => x.name === f.name)?.text);
    expect(s.canvas.connections).toEqual(connections);
    expect(s.canvas.components).toEqual(components);
  });

  it("a visual element is never 'outside the YAML'", async () => {
    await s.engine.canvasChanged();
    const outside = s.events
      .filter((e): e is Extract<EngineEvent, { type: "outside" }> => e.type === "outside")
      .at(-1);
    expect(outside?.ids).toEqual([]);
  });
});

describe("edits of the visual layer", () => {
  it("moving a boundary writes opscr.visual.json, moves what it holds, and never touches the YAML", async () => {
    const before = s.files.filter((f) => f.name.endsWith(".opscr.yaml")).map((f) => f.text);
    const region = s.byLabel("Region: us-east-1")!;
    s.canvas.step(() => {
      region.position = { x: region.position!.x + 40, y: region.position!.y + 25 };
    });
    await s.engine.canvasChanged();
    expect(s.files.filter((f) => f.name.endsWith(".opscr.yaml")).map((f) => f.text)).toEqual(
      before,
    );
    const visual = parseVisualFile(s.text(VISUAL_FILE)!)!;
    const key = Object.keys(visual.elements).find(
      (k) => visual.elements[k]!.label === "Region: us-east-1",
    )!;
    const original = parseVisualFile(
      (await importedFiles(DRAWING)).find((f) => f.name === VISUAL_FILE)!.text,
    )!;
    expect(visual.elements[key]!.box.x - original.elements[key]!.box.x).toBe(40);
    expect(visual.elements[key]!.box.y - original.elements[key]!.box.y).toBe(25);
  });

  it("deleting a monitoring hub removes it and its edges, and it stays deleted", async () => {
    const before = s.manifestTexts();
    const hub = s.canvas.components.find((c) => c.cloudServiceId === "cloudwatch")!;
    s.canvas.step(() => s.canvas.remove([hub.id]));
    await s.engine.canvasChanged();
    expect(s.manifestTexts()).toEqual(before);
    const visual = parseVisualFile(s.text(VISUAL_FILE)!)!;
    expect(Object.values(visual.elements).some((e) => e.hint === "aws:cloudwatch")).toBe(false);
    await s.engine.sync();
    expect(s.canvas.components.some((c) => c.cloudServiceId === "cloudwatch")).toBe(false);
  });

  it("an element moved inside a visual panel keeps opscr.layout.json relative to its manifest parent", async () => {
    const layoutBefore = s.text(LAYOUT_FILE);
    await s.engine.canvasChanged();
    expect(s.text(LAYOUT_FILE)).toBe(layoutBefore);
  });

  it("an outside change of opscr.visual.json moves the canvas", async () => {
    const visual = parseVisualFile(s.text(VISUAL_FILE)!)!;
    const key = Object.keys(visual.elements).find(
      (k) => visual.elements[k]!.label === "Region: us-east-1",
    )!;
    visual.elements[key]!.box.x += 100;
    s.files = s.files.map((f) =>
      f.name === VISUAL_FILE ? { ...f, text: JSON.stringify(visual) } : f,
    );
    const x = s.byLabel("Region: us-east-1")!.position!.x;
    await s.engine.visualChanged();
    expect(s.byLabel("Region: us-east-1")!.position!.x).toBe(x + 100);
  });
});
