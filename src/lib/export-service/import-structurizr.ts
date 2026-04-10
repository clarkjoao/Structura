import type { Component, Connection, Diagram, NodeLayout } from "@/features/diagram";
import {
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
  generateId,
  NODE_DRAG_PADDING,
  PANEL_DEFAULT_H,
  PANEL_DEFAULT_W,
} from "@/features/diagram";

// ── Types ──────────────────────────────────────────────────────────────────

type Level = "context" | "container" | "component";

interface ParsedElement {
  dslId: string;
  type: "person" | "system" | "container" | "component";
  name: string;
  description: string;
  technology?: string;
  tags: string[];
  parentDslId: string | null;
}

interface ParsedRelationship {
  sourceDslId: string;
  targetDslId: string;
  label: string;
  technology?: string;
}

interface ParsedWorkspace {
  name: string;
  description: string;
  level: Level;
  elements: ParsedElement[];
  relationships: ParsedRelationship[];
}

// ── Tokenizer / Parser ────────────────────────────────────────────────────

function stripComments(dsl: string): string {
  return dsl
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

function extractStrings(line: string): string[] {
  const results: string[] = [];
  const re = /"([^"]*)"/g;
  let stringMatch: RegExpExecArray | null;
  while ((stringMatch = re.exec(line)) !== null) results.push(stringMatch[1]);
  return results;
}

function detectLevel(dsl: string): Level {
  const idx = dsl.search(/views\s*\{/i);
  const fromViews = idx === -1 ? dsl : dsl.slice(idx);
  if (/component\s+[\w.]+\s*\{/i.test(fromViews)) return "component";
  if (/container\s+[\w.]+\s*\{/i.test(fromViews)) return "container";
  if (
    /\bsystemContext\s+[\w.]+\s*\{/i.test(fromViews) ||
    /\bsystemLandscape\s+[\w.]+\s*\{/i.test(fromViews)
  ) {
    return "context";
  }
  if (/\bsystemContext\b/i.test(dsl) || /\bsystemLandscape\b/i.test(dsl)) return "context";
  return "context";
}

type StructurizrElementType = "person" | "softwareSystem" | "container" | "component";

function toStructuraType(
  dslType: StructurizrElementType,
): "person" | "system" | "container" | "component" {
  switch (dslType) {
    case "person":
      return "person";
    case "softwareSystem":
      return "system";
    case "container":
      return "container";
    case "component":
      return "component";
  }
}

/**
 * Parses DSL text into a ParsedWorkspace.
 * Uses a line-by-line state machine with brace depth tracking.
 */
function parseDsl(dsl: string): ParsedWorkspace {
  const clean = stripComments(dsl);
  const lines = clean.split("\n");
  const elements: ParsedElement[] = [];
  const relationships: ParsedRelationship[] = [];

  let workspaceName = "Imported from Structurizr DSL";
  let workspaceDesc = "";
  const wsMatch = clean.match(/workspace\s+"([^"]*)"(?:\s+"([^"]*)")?/);
  if (wsMatch) {
    workspaceName = wsMatch[1] || workspaceName;
    workspaceDesc = wsMatch[2] || "";
  }

  const hierarchicalIds = /!identifiers\s+hierarchical\b/i.test(clean);

  let depth = 0;
  let activeSection: "model" | "views" | null = null;

  const elementStack: Array<{ dslId: string; openDepth: number }> = [];

  const ELEMENT_TYPES: StructurizrElementType[] = [
    "person",
    "softwareSystem",
    "container",
    "component",
  ];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const opens = (line.match(/\{/g) ?? []).length;
    const closes = (line.match(/\}/g) ?? []).length;

    let newElementOpen: { dslId: string } | null = null;

    if (activeSection === "model") {
      const relMatch = line.match(/^(\S+)\s*->\s*(\S+)\s*/);
      if (relMatch && !line.includes("=")) {
        const strs = extractStrings(line);
        relationships.push({
          sourceDslId: relMatch[1],
          targetDslId: relMatch[2],
          label: strs[0] ?? "",
          technology: strs[1],
        });
      } else {
        let elementMatched = false;
        for (const elType of ELEMENT_TYPES) {
          const elPattern = new RegExp(
            `^(?:(\\w+)\\s*=\\s*)?${elType}\\s+"([^"]*)"(?:\\s+"([^"]*)")?(?:\\s+"([^"]*)")?`,
            "i",
          );
          const elementMatch = line.match(elPattern);
          if (!elementMatch) continue;

          elementMatched = true;
          const localId = elementMatch[1] ?? "";
          const name = elementMatch[2] ?? "";
          const desc = elementMatch[3] ?? "";
          const tech = elementMatch[4];

          const parentEntry = elementStack.at(-1);
          const parentDslId = parentEntry?.dslId ?? null;

          let dslId: string;
          if (localId) {
            dslId =
              hierarchicalIds && parentDslId ? `${parentDslId}.${localId}` : localId;
          } else {
            dslId = `_anon_${elements.length}`;
          }

          elements.push({
            dslId,
            type: toStructuraType(elType),
            name,
            description: desc,
            technology: tech,
            tags: [],
            parentDslId,
          });

          if (line.includes("{")) {
            newElementOpen = { dslId };
          }
          break;
        }

        if (
          !elementMatched &&
          /^tags\s+/i.test(line) &&
          elementStack.length > 0
        ) {
          const strs = extractStrings(line);
          const currentDslId = elementStack.at(-1)!.dslId;
          const currentEl = [...elements].reverse().find((e) => e.dslId === currentDslId);
          if (currentEl) {
            currentEl.tags = strs.flatMap((s) =>
              s
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean),
            );
          }
        }
      }
    }

    depth += opens - closes;

    if (/^model\s*\{/.test(line)) {
      activeSection = "model";
    }
    if (/^views\s*\{/.test(line)) {
      activeSection = "views";
    }
    if (depth <= 1) {
      activeSection = null;
    }

    while (elementStack.length > 0 && elementStack.at(-1)!.openDepth > depth) {
      elementStack.pop();
    }
    if (newElementOpen) {
      elementStack.push({ dslId: newElementOpen.dslId, openDepth: depth });
    }
  }

  return {
    name: workspaceName,
    description: workspaceDesc,
    level: detectLevel(clean),
    elements,
    relationships,
  };
}

// ── Layout ────────────────────────────────────────────────────────────────

const GAP_H = 60;
const CHILD_OFFSET_BELOW_PARENT = 40;

function computeAutoLayout(
  elements: ParsedElement[],
): Map<string, { x: number; y: number; w: number; h: number }> {
  const result = new Map<string, { x: number; y: number; w: number; h: number }>();

  const byParent = new Map<string | null, ParsedElement[]>();
  for (const el of elements) {
    const key = el.parentDslId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(el);
  }

  const topLevel = byParent.get(null) ?? [];

  let cursorX = NODE_DRAG_PADDING;
  for (const el of topLevel) {
    const hasKids = (byParent.get(el.dslId) ?? []).length > 0;
    const w = hasKids ? PANEL_DEFAULT_W : DEFAULT_NODE_W;
    const h = hasKids ? PANEL_DEFAULT_H : DEFAULT_NODE_H;
    result.set(el.dslId, { x: cursorX, y: NODE_DRAG_PADDING, w, h });
    cursorX += w + GAP_H;
  }

  function layoutChildren(parentDslId: string): void {
    const kids = byParent.get(parentDslId) ?? [];
    if (kids.length === 0) return;

    const parentGeom = result.get(parentDslId);
    if (!parentGeom) return;

    const startY = parentGeom.y + parentGeom.h + CHILD_OFFSET_BELOW_PARENT;
    let curX = parentGeom.x;

    for (const kid of kids) {
      const hasGrandkids = (byParent.get(kid.dslId) ?? []).length > 0;
      const w = hasGrandkids ? PANEL_DEFAULT_W : DEFAULT_NODE_W;
      const h = hasGrandkids ? PANEL_DEFAULT_H : DEFAULT_NODE_H;
      result.set(kid.dslId, { x: curX, y: startY, w, h });
      curX += w + GAP_H;
      layoutChildren(kid.dslId);
    }
  }

  for (const el of topLevel) {
    layoutChildren(el.dslId);
  }

  return result;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * Parses Structurizr DSL and returns a Structura Diagram ready for
 * importDiagram() store action.
 *
 * @throws {Error} if the DSL cannot be parsed (no elements found)
 */
export function importStructurizr(dsl: string): Diagram {
  const parsed = parseDsl(dsl);

  if (parsed.elements.length === 0) {
    throw new Error(
      "No C4 elements found in DSL. Check that the file contains person, softwareSystem, container, or component declarations.",
    );
  }

  const now = new Date().toISOString();
  const diagramId = generateId("d");

  const idMap = new Map<string, string>();
  for (const el of parsed.elements) {
    idMap.set(el.dslId, generateId("el"));
  }

  const components: Record<string, Component> = {};
  for (const el of parsed.elements) {
    const id = idMap.get(el.dslId)!;
    const parentId = el.parentDslId ? (idMap.get(el.parentDslId) ?? null) : null;
    const comp: Component = {
      id,
      type: el.type,
      name: el.name || el.dslId,
      description: el.description,
      parentId,
      tags: el.tags.length > 0 ? el.tags : undefined,
      ...(el.technology ? { technology: el.technology } : {}),
    };
    components[id] = comp;
  }

  const connections: Record<string, Connection> = {};
  for (const rel of parsed.relationships) {
    const sourceId = idMap.get(rel.sourceDslId);
    const targetId = idMap.get(rel.targetDslId);
    if (!sourceId || !targetId) continue;
    const id = generateId("conn");
    connections[id] = {
      id,
      sourceId,
      targetId,
      label: rel.label,
      technology: rel.technology,
    };
  }

  const layoutMap = computeAutoLayout(parsed.elements);
  const nodeLayouts: Record<string, NodeLayout> = {};
  for (const el of parsed.elements) {
    const id = idMap.get(el.dslId)!;
    const pos = layoutMap.get(el.dslId) ?? {
      x: 0,
      y: 0,
      w: DEFAULT_NODE_W,
      h: DEFAULT_NODE_H,
    };
    nodeLayouts[id] = {
      elementId: id,
      x: pos.x,
      y: pos.y,
      width: pos.w,
      height: pos.h,
    };
  }

  const diagram: Diagram = {
    id: diagramId,
    name: parsed.name,
    description: parsed.description || undefined,
    level: parsed.level,
    createdAt: now,
    updatedAt: now,
    snapshot: {
      components,
      connections,
      flows: {},
      iconLibrary: {},
    },
    nodeLayouts,
    edgeLayouts: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  return diagram;
}
