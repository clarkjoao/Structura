import { afterEach, describe, expect, it, vi } from "vitest";
import type { ExporterContribution, ImporterContribution } from "./plugin.types";
import {
  findImportersForFile,
  getExporterContribution,
  getImporterContribution,
  getIoRegistrySnapshot,
  registerExporterContribution,
  registerImporterContribution,
  subscribeIoRegistry,
  unregisterExporterContribution,
  unregisterImporterContribution,
} from "./io-registry";

const importer: ImporterContribution = {
  id: "mermaid-flowchart",
  label: "Mermaid",
  extensions: ["mmd", "mermaid"],
  canImport: (_name, contents) => /^\s*(flowchart|graph)\b/m.test(contents),
  import: () => ({ components: [], connections: [], warnings: [] }),
};

const exporter: ExporterContribution = {
  id: "plantuml",
  label: "PlantUML",
  extension: "puml",
  mime: "text/plain",
  export: () => "@startuml\n@enduml",
};

afterEach(() => {
  unregisterImporterContribution(importer.id);
  unregisterExporterContribution(exporter.id);
});

describe("io-registry", () => {
  it("registers and retrieves importers and exporters", () => {
    registerImporterContribution(importer);
    registerExporterContribution(exporter);
    expect(getImporterContribution("mermaid-flowchart")).toBe(importer);
    expect(getExporterContribution("plantuml")).toBe(exporter);
    expect(getIoRegistrySnapshot().importers).toHaveLength(1);
    expect(getIoRegistrySnapshot().exporters).toHaveLength(1);
  });

  it("throws on duplicate ids and keeps the existing contribution (spec scenarios)", () => {
    registerImporterContribution(importer);
    const replacement = { ...importer, label: "Other" };
    expect(() => registerImporterContribution(replacement)).toThrowError("mermaid-flowchart");
    expect(getImporterContribution("mermaid-flowchart")).toBe(importer);

    registerExporterContribution(exporter);
    expect(() => registerExporterContribution({ ...exporter })).toThrowError("plantuml");
    expect(getExporterContribution("plantuml")).toBe(exporter);
  });

  it("notifies subscribers with a fresh snapshot identity", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeIoRegistry(listener);
    const before = getIoRegistrySnapshot();
    registerImporterContribution(importer);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getIoRegistrySnapshot()).not.toBe(before);
    unsubscribe();
    unregisterImporterContribution(importer.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("finds importers by extension and content sniffing", () => {
    registerImporterContribution(importer);
    expect(findImportersForFile("diagram.mmd", "flowchart TD\nA-->B")).toHaveLength(1);
    expect(findImportersForFile("diagram.MMD", "graph LR\nA-->B")).toHaveLength(1);
    expect(findImportersForFile("diagram.mmd", "sequenceDiagram")).toHaveLength(0);
    expect(findImportersForFile("diagram.txt", "flowchart TD")).toHaveLength(0);
    expect(findImportersForFile("no-extension", "flowchart TD")).toHaveLength(0);
  });
});
