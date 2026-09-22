# Workspace Bulk Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk export capability to the dashboard allowing users to export selected diagrams, entire folders, or the whole workspace in JSON, Draw.io, and Mermaid formats.

**Architecture:** Build a new `buildWorkspaceExportFiles` utility that generates zip entries with folder-preserving paths, then create a `WorkspaceExportModal` component that handles scope selection and integrates with the dashboard's existing multi-select infrastructure.

**Tech Stack:** React, TypeScript, Vitest, JSZip (already used in project)

**Spec:** `docs/superpowers/specs/2026-09-21-workspace-bulk-export-design.md`

---

## Global Constraints

- Mermaid exports for ALL diagrams, even those without flows (may produce minimal output)
- Folder structure preserved in ZIP with folder prefix for naming conflicts
- Use existing `downloadZip` from `@/lib/export-service`
- Follow existing test patterns from `build-export-files.test.ts`

---

## File Map

### New Files
- `src/lib/export-service/build-workspace-export-files.ts` — Bulk export utility
- `src/lib/export-service/build-workspace-export-files.test.ts` — Tests
- `src/pages/workspace/WorkspaceExportModal.tsx` — Export modal component

### Modified Files
- `src/pages/dashboard/index.tsx` — Add export button to selection bar + modal
- `src/lib/export-service/index.ts` — Export new function

---

## Task 1: Build Workspace Export Utility

**Files:**
- Create: `src/lib/export-service/build-workspace-export-files.ts`
- Create: `src/lib/export-service/build-workspace-export-files.test.ts`
- Modify: `src/lib/export-service/index.ts:1-12`

**Interfaces:**
- Consumes: `DiagramExportFormat`, `ZipEntryFile` from existing export-service
- Produces: `buildWorkspaceExportFiles(options: WorkspaceExportOptions): ZipEntryFile[]`

### Step 1: Create test file with failing tests

Create `src/lib/export-service/build-workspace-export-files.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { Diagram, Folder } from "@/features/diagram";
import { buildWorkspaceExportFiles } from "./build-workspace-export-files";

function minimalDiagram(overrides: Partial<Diagram> = {}): Diagram {
  const base: Diagram = {
    id: "d1",
    name: "API Design",
    level: "container",
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

function minimalFolder(overrides: Partial<Folder> = {}): Folder {
  return {
    id: "f1",
    name: "Backend",
    parentId: null,
    ...overrides,
  };
}

describe("buildWorkspaceExportFiles", () => {
  it("returns empty array for empty diagrams array", () => {
    const result = buildWorkspaceExportFiles({
      diagrams: [],
      formats: ["json", "drawio"],
      services: {},
      folders: {},
    });
    expect(result).toEqual([]);
  });

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
    expect(result[0]?.filename).toBe("backend_api-gateway.json");
  });

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
    expect(result[0]?.filename).toBe("backend-auth_auth.json");
  });

  it("uses mermaid suffix only for mermaid format", () => {
    const diagram = minimalDiagram({ name: "Service" });
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["json", "drawio", "mermaid"],
      services: {},
      folders: {},
    });
    expect(result[0]?.filename).toBe("service.json");
    expect(result[1]?.filename).toBe("service.drawio");
    expect(result[2]?.filename).toBe("service-flows.md");
  });

  it("sanitizes special characters in names", () => {
    const diagram = minimalDiagram({ name: "API Gateway (v2)!" });
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["json"],
      services: {},
      folders: {},
    });
    expect(result[0]?.filename).toBe("api-gateway-v2-.json");
  });

  it("exports mermaid for diagrams without flows (empty flows array)", () => {
    const diagram = minimalDiagram();
    const result = buildWorkspaceExportFiles({
      diagrams: [diagram],
      formats: ["mermaid"],
      services: {},
      folders: {},
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.filename).toBe("api-design-flows.md");
    // Content should be empty string (no flows)
    expect(result[0]?.content).toBe("");
  });
});
```

### Step 2: Run tests to verify they fail

Run: `cd /Users/clark/www/Structura && npm test -- --run src/lib/export-service/build-workspace-export-files.test.ts`
Expected: FAIL with "buildWorkspaceExportFiles is not a function"

### Step 3: Implement the utility

Create `src/lib/export-service/build-workspace-export-files.ts`:

```typescript
import type { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import type { DiagramExportFormat } from "./build-export-files";
import type { ZipEntryFile } from "./download-file";
import { exportJSON } from "./export-json";
import { exportDrawio } from "./export-drawio";
import { exportMermaid } from "./export-mermaid";

const FORMAT_EXTENSION: Record<DiagramExportFormat, string> = {
  json: "json",
  drawio: "drawio",
  mermaid: "md",
};

interface WorkspaceExportOptions {
  diagrams: Diagram[];
  formats: DiagramExportFormat[];
  services: Record<string, ServiceDefinition>;
  folders: Record<string, Folder>;
}

/**
 * Build a flat list of zip entries for bulk diagram export.
 * Files are named with folder prefixes to avoid conflicts.
 */
export function buildWorkspaceExportFiles(options: WorkspaceExportOptions): ZipEntryFile[] {
  const { diagrams, formats, services, folders } = options;

  const files: ZipEntryFile[] = [];

  for (const diagram of diagrams) {
    const folderPrefix = getFolderPrefix(diagram.folderId, folders);
    const baseName = sanitizeFilename(diagram.name);

    for (const format of formats) {
      const filename = buildFilename(baseName, format, folderPrefix);
      const content = buildExportContent(format, diagram, services);

      files.push({ filename, content });
    }
  }

  return files;
}

function buildFilename(baseName: string, format: DiagramExportFormat, folderPrefix: string): string {
  const ext = FORMAT_EXTENSION[format];
  const suffix = format === "mermaid" ? "-flows" : "";
  const prefix = folderPrefix ? `${folderPrefix}_` : "";
  return `${prefix}${baseName}${suffix}.${ext}`;
}

function buildExportContent(
  format: DiagramExportFormat,
  diagram: Diagram,
  services: Record<string, ServiceDefinition>,
): string {
  switch (format) {
    case "json":
      return exportJSON(diagram, services);
    case "drawio":
      return exportDrawio(diagram, services);
    case "mermaid":
      // Always export mermaid, even without flows
      return exportMermaid([], diagram.snapshot.components, diagram.snapshot.connections);
  }
}

/**
 * Build folder prefix by walking up the folder tree.
 * E.g., diagram in folder "Auth" under "Backend" returns "backend-auth"
 */
function getFolderPrefix(folderId: string | null | undefined, folders: Record<string, Folder>): string {
  if (!folderId) return "";

  const parts: string[] = [];
  let currentId: string | null = folderId;

  while (currentId) {
    const folder = folders[currentId];
    if (!folder) break;
    parts.unshift(sanitizeFilename(folder.name));
    currentId = folder.parentId;
  }

  return parts.join("-");
}

/**
 * Sanitize a name for use in filenames.
 * Replaces spaces and special characters with hyphens, lowercases.
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
```

### Step 4: Run tests to verify they pass

Run: `npm test -- --run src/lib/export-service/build-workspace-export-files.test.ts`
Expected: PASS

### Step 5: Export from index

Modify `src/lib/export-service/index.ts` to add the new export:

```typescript
// Add after line 9
export { buildWorkspaceExportFiles } from "./build-workspace-export-files";
```

### Step 6: Commit

```bash
git add src/lib/export-service/build-workspace-export-files.ts src/lib/export-service/build-workspace-export-files.test.ts src/lib/export-service/index.ts
git commit -m "feat: add buildWorkspaceExportFiles utility for bulk workspace export"
```

---

## Task 2: Create WorkspaceExportModal Component

**Files:**
- Create: `src/pages/workspace/WorkspaceExportModal.tsx`
- Modify: `src/lib/export-service/index.ts` (already done in Task 1)

**Interfaces:**
- Consumes: `DiagramExportFormat`, `buildWorkspaceExportFiles` from `@/lib/export-service`
- Produces: `WorkspaceExportModal` React component with props: `{ open, onOpenChange, diagrams, folders, services, selectedIds, selectedFolderId }`

### Step 1: Create the modal component

Create `src/pages/workspace/WorkspaceExportModal.tsx`:

```typescript
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, FileJson, FileImage, FolderOpen, Globe, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { buildWorkspaceExportFiles, downloadZip, type DiagramExportFormat } from "@/lib/export-service";
import type { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { toast } from "sonner";

type ExportScope = "selected" | "folder" | "workspace";

interface WorkspaceExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  diagrams: Diagram[];
  folders: Record<string, Folder>;
  services: Record<string, ServiceDefinition>;
  selectedIds: Set<string>;
  selectedFolderId: string | null;
}

export function WorkspaceExportModal({
  open,
  onOpenChange,
  diagrams,
  folders,
  services,
  selectedIds,
  selectedFolderId,
}: WorkspaceExportModalProps) {
  const { t } = useTranslation();
  const [scope, setScope] = useState<ExportScope>("selected");
  const [selectedFormats, setSelectedFormats] = useState<Set<DiagramExportFormat>>(
    new Set(["json", "drawio"]),
  );

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setScope(selectedIds.size > 0 ? "selected" : "workspace");
      setSelectedFormats(new Set(["json", "drawio"]));
    }
  }, [open, selectedIds.size]);

  // Compute diagrams for each scope
  const scopeDiagrams = useMemo(() => {
    switch (scope) {
      case "selected":
        return diagrams.filter((d) => selectedIds.has(d.id));
      case "folder":
        return getDiagramsInFolder(selectedFolderId, diagrams);
      case "workspace":
        return diagrams;
    }
  }, [scope, diagrams, selectedIds, selectedFolderId]);

  const scopeLabel = useMemo(() => {
    const count = scopeDiagrams.length;
    switch (scope) {
      case "selected":
        return t("export.workspace.scopeSelected", { count });
      case "folder":
        return t("export.workspace.scopeFolder", { count });
      case "workspace":
        return t("export.workspace.scopeWorkspace", { count });
    }
  }, [scope, scopeDiagrams.length, t]);

  const toggleFormat = (format: DiagramExportFormat) => {
    setSelectedFormats((prev) => {
      const next = new Set(prev);
      if (next.has(format)) next.delete(format);
      else next.add(format);
      return next;
    });
  };

  const handleExport = useCallback(async () => {
    if (scopeDiagrams.length === 0 || selectedFormats.size === 0) return;

    try {
      const files = buildWorkspaceExportFiles({
        diagrams: scopeDiagrams,
        formats: Array.from(selectedFormats),
        services,
        folders,
      });

      const timestamp = new Date().toISOString().slice(0, 10);
      void downloadZip(files, `export-${timestamp}.zip`);
      toast.success(t("export.workspace.success", { count: files.length }));
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("export.workspace.error"));
    }
  }, [scopeDiagrams, selectedFormats, services, folders, t, onOpenChange]);

  const formatOptions: Array<{
    format: DiagramExportFormat;
    icon: typeof FileJson;
    title: string;
    description: string;
  }> = [
    {
      format: "json",
      icon: FileJson,
      title: t("export.options.json.title"),
      description: t("export.options.json.description"),
    },
    {
      format: "drawio",
      icon: FileImage,
      title: t("export.options.drawio.title"),
      description: t("export.options.drawio.description"),
    },
    {
      format: "mermaid",
      icon: FileImage,
      title: t("export.options.mermaid.title"),
      description: t("export.workspace.mermaidNote"),
    },
  ];

  const canExport = scopeDiagrams.length > 0 && selectedFormats.size > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {t("export.workspace.title")}
          </DialogTitle>
          <DialogDescription>{t("export.workspace.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scope Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t("export.workspace.scopeLabel")}
            </label>
            <div className="space-y-2">
              <ScopeOption
                active={scope === "selected"}
                onClick={() => setScope("selected")}
                icon={CheckSquare}
                title={t("export.workspace.scopeSelected", { count: selectedIds.size })}
                disabled={selectedIds.size === 0}
              />
              <ScopeOption
                active={scope === "folder"}
                onClick={() => setScope("folder")}
                icon={FolderOpen}
                title={t("export.workspace.scopeFolder", {
                  count: getDiagramsInFolder(selectedFolderId, diagrams).length,
                })}
                disabled={!selectedFolderId}
              />
              <ScopeOption
                active={scope === "workspace"}
                onClick={() => setScope("workspace")}
                icon={Globe}
                title={t("export.workspace.scopeWorkspace", { count: diagrams.length })}
              />
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t("export.workspace.formatLabel")}
            </label>
            <div className="space-y-2">
              {formatOptions.map(({ format, icon: Icon, title, description }) => (
                <button
                  key={format}
                  type="button"
                  onClick={() => toggleFormat(format)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
                    selectedFormats.has(format)
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50 hover:bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg",
                      selectedFormats.has(format) ? "bg-primary text-primary-foreground" : "bg-muted",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              {t("export.workspace.previewLabel", { count: scopeDiagrams.length })}
            </label>
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs font-mono max-h-32 overflow-y-auto">
              {scopeDiagrams.length === 0 ? (
                <span className="text-muted-foreground">{t("export.workspace.noDiagrams")}</span>
              ) : (
                scopeDiagrams.slice(0, 10).map((d) => {
                  const prefix = getFolderPrefix(d.folderId, folders);
                  const name = prefix ? `${prefix}_${sanitize(d.name)}` : sanitize(d.name);
                  return (
                    <div key={d.id} className="text-muted-foreground">
                      {name}.{selectedFormats.has("mermaid") ? "{json,drawio,md}" : selectedFormats.has("drawio") ? "{json,drawio}" : "json"}
                    </div>
                  );
                })
              )}
              {scopeDiagrams.length > 10 && (
                <div className="text-muted-foreground mt-1">
                  ... +{scopeDiagrams.length - 10} more
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleExport} disabled={!canExport}>
            <Download className="h-4 w-4" />
            {t("export.workspace.exportButton", { count: scopeDiagrams.length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScopeOption({
  active,
  onClick,
  icon: Icon,
  title,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof CheckSquare;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-all",
        active
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">{title}</span>
    </button>
  );
}

function getDiagramsInFolder(folderId: string | null, diagrams: Diagram[]): Diagram[] {
  const direct = diagrams.filter((d) => d.folderId === folderId);
  // Include diagrams from subfolders
  const subfolderIds = Object.keys(diagrams) // placeholder - will compute properly
    .filter(() => false); // Will be fixed in implementation

  // Get all subfolder IDs recursively
  const getAllSubfolderIds = (parentId: string | null, folders: Record<string, Folder>): string[] => {
    const children = Object.values(folders).filter((f) => f.parentId === parentId);
    const childIds = children.map((c) => c.id);
    const nested = children.flatMap((c) => getAllSubfolderIds(c.id, folders));
    return [...childIds, ...nested];
  };

  const allFolderIds = [folderId, ...getAllSubfolderIds(folderId, {})].filter(Boolean) as string[];
  const nested = diagrams.filter((d) => allFolderIds.includes(d.folderId ?? ""));

  return [...direct, ...nested.filter((d) => d.folderId !== folderId)];
}

function getFolderPrefix(folderId: string | null | undefined, folders: Record<string, Folder>): string {
  if (!folderId) return "";
  const parts: string[] = [];
  let currentId: string | null = folderId;
  while (currentId) {
    const folder = folders[currentId];
    if (!folder) break;
    parts.unshift(sanitize(folder.name));
    currentId = folder.parentId;
  }
  return parts.join("-");
}

function sanitize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
```

### Step 2: Fix the getDiagramsInFolder helper

The inline function has issues. Fix the helper function:

```typescript
function getDiagramsInFolder(folderId: string | null, diagrams: Diagram[], folders: Record<string, Folder>): Diagram[] {
  const direct = diagrams.filter((d) => d.folderId === folderId);

  // Get all subfolder IDs recursively
  const getAllSubfolderIds = (parentId: string | null): string[] => {
    const children = Object.values(folders).filter((f) => f.parentId === parentId);
    const childIds = children.map((c) => c.id);
    const nested = children.flatMap((c) => getAllSubfolderIds(c.id));
    return [...childIds, ...nested];
  };

  const allFolderIds = [folderId, ...getAllSubfolderIds(folderId)].filter(Boolean) as string[];
  const nested = diagrams.filter((d) => allFolderIds.includes(d.folderId ?? "") && d.folderId !== folderId);

  return [...direct, ...nested];
}
```

And update the call sites to pass `folders`.

### Step 3: Add i18n translations

Add to your i18n files (the exact location depends on your i18n setup - typically `src/i18n/locales/en/*.json`):

```json
{
  "export": {
    "workspace": {
      "title": "Export Workspace",
      "description": "Export multiple diagrams at once",
      "scopeLabel": "Scope",
      "scopeSelected": "Selected ({{count}} diagrams)",
      "scopeFolder": "This folder ({{count}} diagrams)",
      "scopeWorkspace": "All workspace ({{count}} diagrams)",
      "formatLabel": "Format",
      "mermaidNote": "Exports for all diagrams",
      "previewLabel": "Preview ({{count}} files)",
      "noDiagrams": "No diagrams to export",
      "exportButton": "Export {{count}} diagrams",
      "success": "Exported {{count}} files",
      "error": "Export failed"
    }
  }
}
```

### Step 4: Test the modal renders

Run the app and verify the modal opens without errors.
Note: Full integration testing will be done in Task 3.

### Step 5: Commit

```bash
git add src/pages/workspace/WorkspaceExportModal.tsx
git commit -m "feat: add WorkspaceExportModal component"
```

---

## Task 3: Integrate into Dashboard

**Files:**
- Modify: `src/pages/dashboard/index.tsx:776-808` (selection bar area)
- Modify: `src/pages/dashboard/index.tsx` (add modal + state)

**Interfaces:**
- Consumes: `WorkspaceExportModal` from `./workspace/WorkspaceExportModal`
- Produces: Export button in selection bar, modal rendered

### Step 1: Add imports and state to Dashboard

Add to the imports section of `src/pages/dashboard/index.tsx`:

```typescript
import { WorkspaceExportModal } from "@/pages/workspace/WorkspaceExportModal";
```

Add state near the other modal states (around line 131):

```typescript
const [workspaceExportOpen, setWorkspaceExportOpen] = useState(false);
```

### Step 2: Add Export button to selection bar

Find the selection bar around line 776-808 and add an export button:

```typescript
// Replace the existing selection bar content with:
<div className="flex shrink-0 items-center gap-2">
  <Button type="button" variant="outline" size="sm" onClick={clearSelection}>
    {t("bulkDelete.clearSelection")}
  </Button>
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={() => setWorkspaceExportOpen(true)}
    className="gap-1.5"
  >
    <Download className="h-3.5 w-3.5" />
    {t("export.workspace.selectionBarExport")}
  </Button>
  <Button
    type="button"
    variant="destructive"
    size="sm"
    onClick={() => setBulkDeleteOpen(true)}
  >
    {t("bulkDelete.deleteSelected")}
  </Button>
</div>
```

Add `Download` to the imports from lucide-react if not already present.

### Step 3: Add modal rendering

Add after the other modals (after line 816):

```typescript
<WorkspaceExportModal
  open={workspaceExportOpen}
  onOpenChange={setWorkspaceExportOpen}
  diagrams={diagrams}
  folders={folders}
  services={{}} // Will get services from store - see step 4
  selectedIds={selectedIds}
  selectedFolderId={selectedFolderId}
/>
```

### Step 4: Get services from diagram store

The export needs services. Get them from the store:

First, add to imports:
```typescript
import { useServices } from "@/features/diagram";
```

Add near the top of the component (after other hooks):
```typescript
const services = useServices();
```

Convert to Record<string, ServiceDefinition>:
```typescript
const servicesRecord = useMemo(() => {
  const record: Record<string, ServiceDefinition> = {};
  for (const service of services) {
    record[service.id] = service;
  }
  return record;
}, [services]);
```

Then pass `servicesRecord` instead of `{}` to the modal.

### Step 5: Add translation key

Add to your translations:
```json
{
  "export": {
    "workspace": {
      "selectionBarExport": "Export"
    }
  }
}
```

### Step 6: Test the full flow

1. Go to `/workspace`
2. Select multiple diagrams (Ctrl/Cmd + click)
3. Click Export in the selection bar
4. Modal opens with correct scope and format options
5. Select formats and click Export
6. ZIP downloads with correct folder structure

### Step 7: Commit

```bash
git add src/pages/dashboard/index.tsx
git commit -m "feat: integrate WorkspaceExportModal into dashboard"
```

---

## Task 4: Add Folder Context Menu Export (Optional Enhancement)

**Files:**
- Modify: `src/components/folders/FolderTree.tsx`

This is optional but improves discoverability. If you want to add it:

### Step 1: Add export action to FolderTreeItem dropdown

In `FolderTreeItem`, add a new `onExport` prop:

```typescript
interface FolderTreeItemProps {
  // ... existing props
  onExport?: (folderId: string) => void;
}
```

Add the export button to the dropdown menu:

```typescript
<DropdownMenuItem onClick={() => onExport?.(folder.id)}>
  <Download className="h-3.5 w-3.5 mr-2" />
  {t("export.workspace.exportFolder")}
</DropdownMenuItem>
```

### Step 2: Wire it up in FolderTree

Pass the export handler from Dashboard.

This task is optional - the main bulk export works without it.

---

## Verification Checklist

- [ ] Select 3 diagrams → Export → ZIP contains 6 files (3 diagrams × 2 formats)
- [ ] Select folder "Backend" with 5 diagrams → Export → ZIP has folder structure
- [ ] Export entire workspace → ZIP contains all diagrams
- [ ] JSON files contain valid diagram data
- [ ] Draw.io files are valid XML
- [ ] Mermaid exports work (even for flow-less diagrams)
- [ ] Naming conflicts resolved with folder prefix
- [ ] Modal closes after export
- [ ] Error handling works (toast on failure)
