# Workspace Bulk Export — Design Spec

**Date**: 2026-09-21
**Status**: Draft

## Overview

Add bulk export capability to the `/workspace` (dashboard) allowing users to export multiple diagrams, entire folders, or the whole workspace in JSON, Draw.io, and Mermaid formats.

## Scope Levels

| Scope | Description |
|-------|-------------|
| **Selected** | Export diagrams currently selected via multi-select in the dashboard |
| **This folder** | Export all diagrams in the currently viewed folder (via `selectedFolderId` URL param) |
| **All workspace** | Export every diagram in the workspace |

## Export Formats

| Format | Extension | Description |
|--------|----------|-------------|
| JSON | `.json` | Full diagram data with service manifest |
| Draw.io | `.drawio` | XML format for draw.io/diagrams.net |
| Mermaid | `.md` | Markdown with mermaid diagram code |

### Mermaid Behavior

Mermaid exports are generated for **all diagrams**, including those without flows. For diagrams without flows, the output may be minimal (just diagram name metadata with no diagram content).

## Folder Structure in ZIP

Files are organized hierarchically matching workspace folder structure:

```
export.zip
├── api-gateway/
│   ├── api-gateway-design.json
│   ├── api-gateway-design.drawio
│   └── api-gateway-design-flows.md
├── backend/
│   ├── auth-service.json
│   └── auth-service.drawio
└── root-diagram.json
```

### Naming Conventions

- **Root-level diagrams**: `{diagram-name}.{ext}`
- **Folder diagrams**: `{folder-name}_{diagram-name}.{ext}`
- **Spaces/special chars**: Replaced with hyphens
- **Diagrams in subfolders**: Use parent folder names recursively, e.g., `parent_child_diagram-name.json`

## Components

### New Components

| Component | Path | Purpose |
|-----------|------|---------|
| `WorkspaceExportModal` | `src/pages/workspace/WorkspaceExportModal.tsx` | Modal with scope picker, format selection, and preview |

### New Utilities

| Utility | Path | Purpose |
|---------|------|---------|
| `buildWorkspaceExportFiles` | `src/lib/export-service/build-workspace-export-files.ts` | Generate zip entries for bulk export |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/dashboard/index.tsx` | Add export button to selection bar, add `WorkspaceExportModal` |
| `src/lib/export-service/index.ts` | Export `buildWorkspaceExportFiles` |

## API

### `buildWorkspaceExportFiles`

```typescript
import type { DiagramExportFormat } from "./build-export-files";
import type { Diagram } from "@/features/diagram";
import type { ServiceDefinition } from "@/features/diagram";
import type { ZipEntryFile } from "./download-file";

interface WorkspaceExportOptions {
  diagrams: Diagram[];
  formats: DiagramExportFormat[];
  services: Record<string, ServiceDefinition>;
}

function buildWorkspaceExportFiles(options: WorkspaceExportOptions): ZipEntryFile[]
```

Returns an array of `{ filename, content }` entries suitable for `downloadZip()`.

## UI: WorkspaceExportModal

### Structure

```
┌─────────────────────────────────────────────┐
│ Export Workspace                        [X] │
├─────────────────────────────────────────────┤
│                                             │
│ Scope                                       │
│ ┌─────────────────────────────────────┐   │
│ │ ○ Selected (3 diagrams)               │   │
│ │ ○ This folder (12 diagrams)          │   │
│ │ ○ All workspace (47 diagrams)        │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ Format                                      │
│ ┌─────────────────────────────────────┐   │
│ │ [✓] JSON  Full diagram data         │   │
│ │ [✓] Draw.io  XML for draw.io        │   │
│ │ [ ] Mermaid  Markdown (may be empty │   │
│ │      for diagrams without flows)      │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ Preview                                     │
│ ┌─────────────────────────────────────┐   │
│ │ api-gateway/                         │   │
│ │   ├─ api-gateway-design.json        │   │
│ │   ├─ auth-service.json               │   │
│ │ backend/                             │   │
│ │   └─ backend-auth.json               │   │
│ └─────────────────────────────────────┘   │
│                                             │
│                        [Cancel] [Export]    │
└─────────────────────────────────────────────┘
```

### States

- **No scope available**: If "Selected" chosen but nothing selected, show disabled state with hint
- **Loading preview**: When scope changes, compute diagram list (instant for Selected, may need to compute for folder/workspace)
- **Empty**: If scope yields no diagrams, disable export button with message

### Interactions

1. User clicks "Export" in selection bar
2. Modal opens with "Selected" scope pre-selected (if items selected)
3. User can switch between scopes
4. User selects formats (default: JSON + Draw.io)
5. Preview updates to show files that will be exported
6. User clicks "Export"
7. ZIP downloads with appropriate name: `export-{timestamp}.zip`

## Implementation Notes

### Computing Diagrams for Scope

```typescript
// Selected: use selectedIds from useMultiSelect
const selectedDiagrams = diagrams.filter(d => selectedIds.has(d.id));

// This folder: diagrams in selectedFolderId (including nested subfolders)
function getDiagramsInFolder(folderId: string | null, diagrams: Diagram[]): Diagram[] {
  const direct = diagrams.filter(d => d.folderId === folderId);
  // For subfolders, recursively include
  const subfolders = Object.values(folders).filter(f => f.parentId === folderId);
  const nested = subfolders.flatMap(f => getDiagramsInFolder(f.id, diagrams));
  return [...direct, ...nested];
}

// All workspace: all diagrams
const allDiagrams = diagrams;
```

### Filename Generation

```typescript
function buildFilename(diagram: Diagram, format: DiagramExportFormat, folderName?: string): string {
  const slug = diagram.name.toLowerCase().replace(/\s+/g, "-");
  const ext = FORMAT_EXTENSION[format];
  const suffix = format === "mermaid" ? "-flows" : "";

  if (!folderName) {
    return `${slug}${suffix}.${ext}`;
  }

  const folderSlug = folderName.toLowerCase().replace(/\s+/g, "-");
  return `${folderSlug}_${slug}${suffix}.${ext}`;
}
```

### Zip Structure Generation

```typescript
function buildWorkspaceExportFiles({ diagrams, formats, services }: WorkspaceExportOptions): ZipEntryFile[] {
  const files: ZipEntryFile[] = [];

  for (const diagram of diagrams) {
    const folderName = getFolderName(diagram.folderId);

    for (const format of formats) {
      const filename = buildFilename(diagram, format, folderName);

      let content: string;
      if (format === "json") {
        content = exportJSON(diagram, services);
      } else if (format === "drawio") {
        content = exportDrawio(diagram, services);
      } else {
        // mermaid - always export, even without flows
        content = exportMermaid([], diagram.snapshot.components, diagram.snapshot.connections);
      }

      files.push({ filename, content });
    }
  }

  return files;
}
```

## Testing

1. **Unit tests for `buildWorkspaceExportFiles`**:
   - Empty diagrams array returns empty array
   - Single diagram with multiple formats produces correct file count
   - Folder prefix is correctly applied
   - Mermaid format uses "-flows" suffix
   - Special characters in names are sanitized

2. **Integration tests**:
   - Export modal renders correctly with each scope
   - Format selection persists across scope switches
   - Preview updates when scope or formats change

3. **E2E tests**:
   - Select diagrams → open modal → export → verify ZIP contents

## Acceptance Criteria

- [ ] User can export selected diagrams from dashboard
- [ ] User can export all diagrams in a folder (including nested subfolders)
- [ ] User can export entire workspace
- [ ] All three formats (JSON, Draw.io, Mermaid) work correctly
- [ ] Folder structure is preserved in ZIP
- [ ] Naming conflicts are resolved with folder prefix
- [ ] Mermaid exports work for diagrams with and without flows
- [ ] Empty scope selection shows appropriate disabled state
