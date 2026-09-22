import { describe, expect, it } from "vitest";
import type { Diagram, Folder } from "@/features/diagram";
import { buildWorkspaceExportFiles, planWorkspaceExport } from "./build-workspace-export-files";

function minimalDiagram(overrides: Partial<Diagram> = {}): Diagram {
  const base: Diagram = {
    id: "d1",
    name: "API Design",
    level: "context",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    snapshot: {
      components: {},
      connections: {},
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };
  return { ...base, ...overrides, snapshot: { ...base.snapshot, ...overrides.snapshot } };
}

function minimalFolder(overrides: Partial<Folder>): Folder {
  return {
    id: "f1",
    name: "Folder",
    parentId: null,
    ...overrides,
  };
}

describe("buildWorkspaceExportFiles", () => {
  // Test 1: Empty input
  it("returns empty array for empty diagrams array", () => {
    const result = buildWorkspaceExportFiles({
      diagrams: [],
      formats: ["json"],
      services: {},
      folders: {},
    });
    expect(result).toEqual([]);
  });

  // Test 2: One file per format per diagram
  it("generates one file per format per diagram", () => {
    const diagram = minimalDiagram({ id: "d1", name: "Auth Service" });
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["json", "drawio", "mermaid"],
      services: {},
      folders: {},
    });
    expect(result).toHaveLength(3);
    expect(result.map((f) => f.filename)).toEqual([
      "auth-service.json",
      "auth-service.drawio",
      "auth-service-flows.md",
    ]);
  });

  // Test 3: Folder prefix
  it("applies folder prefix for diagrams in folders", () => {
    const diagram = minimalDiagram({ id: "d1", name: "API Gateway", folderId: "f1" });
    const folders: Record<string, Folder> = {
      f1: minimalFolder({ id: "f1", name: "Backend" }),
    };
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["json"],
      services: {},
      folders,
    });
    expect(result[0].filename).toBe("backend_api-gateway.json");
  });

  // Test 4: Nested folders
  it("applies nested folder prefixes recursively", () => {
    const diagram = minimalDiagram({ id: "d1", name: "Auth", folderId: "f2" });
    const folders: Record<string, Folder> = {
      f1: minimalFolder({ id: "f1", name: "Backend" }),
      f2: minimalFolder({ id: "f2", name: "Auth", parentId: "f1" }),
    };
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["json"],
      services: {},
      folders,
    });
    expect(result[0].filename).toBe("backend-auth_auth.json");
  });

  // Test 5: Mermaid suffix only
  it("uses mermaid suffix only for mermaid format", () => {
    const diagram = minimalDiagram({ name: "Service" });
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["json", "drawio", "mermaid"],
      services: {},
      folders: {},
    });
    expect(result[0].filename).toBe("service.json");
    expect(result[1].filename).toBe("service.drawio");
    expect(result[2].filename).toBe("service-flows.md");
  });

  // Test 6: Special character sanitization
  it("sanitizes special characters in names", () => {
    const diagram = minimalDiagram({ name: "API Gateway (v2)!" });
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["json"],
      services: {},
      folders: {},
    });
    expect(result[0].filename).toBe("api-gateway-v2.json");
  });

  // Test 7: Mermaid for diagrams without flows
  it("exports mermaid for diagrams without flows", () => {
    const diagram = minimalDiagram();
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["mermaid"],
      services: {},
      folders: {},
    });
    expect(result).toHaveLength(1);
    expect(result[0].filename).toBe("api-design-flows.md");
    expect(result[0].content).toBe("# API Design\n");
  });

  it("gives colliding names a numeric suffix shared by all formats of a diagram", () => {
    const result = buildWorkspaceExportFiles({
      diagrams: [
        minimalDiagram({ id: "a", name: "Auth" }),
        minimalDiagram({ id: "b", name: "auth!" }),
        minimalDiagram({ id: "c", name: "AUTH" }),
      ],
      formats: ["json", "drawio"],
      services: {},
      folders: {},
    });
    expect(result.map((f) => f.filename)).toEqual([
      "auth.json",
      "auth.drawio",
      "auth-2.json",
      "auth-2.drawio",
      "auth-3.json",
      "auth-3.drawio",
    ]);
  });

  it("keeps same-named diagrams in different folders apart through the prefix", () => {
    const folders: Record<string, Folder> = {
      f1: minimalFolder({ id: "f1", name: "Backend" }),
      f2: minimalFolder({ id: "f2", name: "Frontend" }),
    };
    const result = buildWorkspaceExportFiles({
      diagrams: [
        minimalDiagram({ id: "a", name: "Overview", folderId: "f1" }),
        minimalDiagram({ id: "b", name: "Overview", folderId: "f2" }),
      ],
      formats: ["json"],
      services: {},
      folders,
    });
    expect(result.map((f) => f.filename)).toEqual([
      "backend_overview.json",
      "frontend_overview.json",
    ]);
  });

  it("folds accents instead of dropping the letter", () => {
    const folders = { f1: minimalFolder({ id: "f1", name: "Catálogo de elementos" }) };
    const result = buildWorkspaceExportFiles({
      diagrams: [minimalDiagram({ name: "Ledger Core — Containers", folderId: "f1" })],
      formats: ["json"],
      services: {},
      folders,
    });
    expect(result[0].filename).toBe("catalogo-de-elementos_ledger-core-containers.json");
  });

  it("falls back to 'untitled' when nothing survives sanitizing", () => {
    const result = buildWorkspaceExportFiles({
      diagrams: [minimalDiagram({ name: "!!!" })],
      formats: ["json"],
      services: {},
      folders: {},
    });
    expect(result[0].filename).toBe("untitled.json");
  });

  it("survives a parent cycle in the folder data", () => {
    const folders: Record<string, Folder> = {
      f1: minimalFolder({ id: "f1", name: "A", parentId: "f2" }),
      f2: minimalFolder({ id: "f2", name: "B", parentId: "f1" }),
    };
    const result = buildWorkspaceExportFiles({
      diagrams: [minimalDiagram({ name: "X", folderId: "f1" })],
      formats: ["json"],
      services: {},
      folders,
    });
    expect(result[0].filename).toBe("b-a_x.json");
  });

  it("plans exactly the filenames the build writes", () => {
    const options = {
      diagrams: [
        minimalDiagram({ id: "a", name: "Auth" }),
        minimalDiagram({ id: "b", name: "Auth" }),
      ],
      formats: ["json", "mermaid"] as const,
      folders: {},
    };
    const planned = planWorkspaceExport({ ...options, formats: [...options.formats] });
    const built = buildWorkspaceExportFiles({
      ...options,
      formats: [...options.formats],
      services: {},
    });
    expect(planned.map((e) => e.filename)).toEqual(built.map((f) => f.filename));
  });
});
