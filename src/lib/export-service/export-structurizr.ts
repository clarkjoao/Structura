import type { C4Component, Component, Connection, Diagram } from "@/features/diagram";
import { diagramWithResolvedScene, isC4Component } from "@/features/diagram";
import { validateDiagram } from "./validate-diagram";

function dslQuote(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function camelTokenFromName(name: string): string {
  const parts = name.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  if (parts.length === 0) return "el";
  return parts
    .map((word, index) =>
      index === 0
        ? word[0].toLowerCase() + word.slice(1).toLowerCase()
        : word[0].toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("");
}

function makeUniqueLocalId(name: string, used: Set<string>): string {
  let base = camelTokenFromName(name);
  if (!/^[a-zA-Z_]/.test(base)) {
    base = `e${base}`;
  }
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

function getEffectiveC4ParentId(
  component: Component,
  byId: Record<string, Component>,
): string | null {
  let current = component.parentId;
  while (current) {
    const parent = byId[current];
    if (!parent) return null;
    if (isC4Component(parent) && !parent.hidden) return current;
    current = parent.parentId;
  }
  return null;
}

function structurizrKeyword(type: C4Component["type"]): string {
  if (type === "system") return "softwareSystem";
  return type;
}

function emitElementStrings(component: C4Component): string {
  let out = dslQuote(component.name);
  if (component.description.trim().length > 0) {
    out += ` ${dslQuote(component.description)}`;
  }
  if (component.technology?.trim()) {
    out += ` ${dslQuote(component.technology)}`;
  }
  return out;
}

function emitModelBlock(
  roots: C4Component[],
  childrenByParent: Map<string | null, C4Component[]>,
  localIdByStructuraId: Map<string, string>,
): string {
  const lines: string[] = [];

  const emitNode = (node: C4Component, indent: string): void => {
    const localId = localIdByStructuraId.get(node.id)!;
    const keyword = structurizrKeyword(node.type);
    const kids = childrenByParent.get(node.id) ?? [];
    const sortedKids = [...kids].sort((a, b) => a.name.localeCompare(b.name));
    const tagLine =
      node.tags && node.tags.length > 0
        ? `${indent}  tags ${dslQuote(node.tags.join(", "))}\n`
        : "";

    if (sortedKids.length === 0 && !tagLine) {
      lines.push(
        `${indent}${localId} = ${keyword} ${emitElementStrings(node)}\n`,
      );
      return;
    }

    lines.push(
      `${indent}${localId} = ${keyword} ${emitElementStrings(node)} {\n`,
    );
    if (tagLine) lines.push(tagLine);
    for (const child of sortedKids) {
      emitNode(child, `${indent}  `);
    }
    lines.push(`${indent}}\n`);
  };

  const sortedRoots = [...roots].sort((a, b) => a.name.localeCompare(b.name));
  for (const root of sortedRoots) {
    emitNode(root, "    ");
  }

  return lines.join("");
}

function emitRelationships(
  connections: Record<string, Connection>,
  components: Record<string, Component>,
  fullDslByStructuraId: Map<string, string>,
): string {
  const lines: string[] = [];
  const sorted = Object.values(connections).sort((a, b) => a.id.localeCompare(b.id));
  for (const connection of sorted) {
    const source = components[connection.sourceId];
    const target = components[connection.targetId];
    if (!source || !target || !isC4Component(source) || !isC4Component(target)) {
      continue;
    }
    if (source.hidden || target.hidden) continue;
    const sourceDsl = fullDslByStructuraId.get(connection.sourceId);
    const targetDsl = fullDslByStructuraId.get(connection.targetId);
    if (!sourceDsl || !targetDsl) continue;

    let line = `    ${sourceDsl} -> ${targetDsl} ${dslQuote(connection.label)}`;
    if (connection.technology?.trim()) {
      line += ` ${dslQuote(connection.technology)}`;
    }
    lines.push(`${line}\n`);
  }
  return lines.join("");
}

function buildViewsSection(
  level: Diagram["level"],
  c4List: C4Component[],
  fullDslByStructuraId: Map<string, string>,
): string {
  const systems = c4List
    .filter((c) => c.type === "system")
    .sort((a, b) => a.name.localeCompare(b.name));
  const containers = c4List
    .filter((c) => c.type === "container")
    .sort((a, b) => a.name.localeCompare(b.name));

  const firstSystemDsl = systems.length
    ? fullDslByStructuraId.get(systems[0].id)
    : undefined;
  const firstContainerDsl = containers.length
    ? fullDslByStructuraId.get(containers[0].id)
    : undefined;

  const lines: string[] = ["  views {"];

  if (level === "component" && firstContainerDsl) {
    lines.push(`    component ${firstContainerDsl} {`);
    lines.push("      include *");
    lines.push("      autolayout tb");
    lines.push("    }");
  } else if (level === "container" && firstSystemDsl) {
    lines.push(`    container ${firstSystemDsl} {`);
    lines.push("      include *");
    lines.push("      autolayout tb");
    lines.push("    }");
  } else if (firstSystemDsl) {
    lines.push(`    systemContext ${firstSystemDsl} {`);
    lines.push("      include *");
    lines.push("      autolayout tb");
    lines.push("    }");
  } else {
    lines.push("    systemLandscape {");
    lines.push("      include *");
    lines.push("      autolayout tb");
    lines.push("    }");
  }

  lines.push("  }");
  return `${lines.join("\n")}\n`;
}

function assignDslIds(
  roots: C4Component[],
  childrenByParent: Map<string | null, C4Component[]>,
  localIdByStructuraId: Map<string, string>,
  fullDslByStructuraId: Map<string, string>,
): void {
  const visit = (nodes: C4Component[], parentFull: string | null): void => {
    const usedLocals = new Set<string>();
    const sorted = [...nodes].sort((a, b) => a.name.localeCompare(b.name));
    for (const node of sorted) {
      const localId = makeUniqueLocalId(node.name, usedLocals);
      localIdByStructuraId.set(node.id, localId);
      const full = parentFull ? `${parentFull}.${localId}` : localId;
      fullDslByStructuraId.set(node.id, full);
      const kids = childrenByParent.get(node.id) ?? [];
      visit(kids, full);
    }
  };
  visit(roots, null);
}

/**
 * Serializes a Structura diagram to Structurizr DSL text (workspace + model + views).
 * Only C4 elements (person, system, container, component) are included; other node types are skipped.
 */
export function exportStructurizr(diagram: Diagram): string {
  validateDiagram(diagram);
  const resolved = diagramWithResolvedScene(diagram);
  const byId = resolved.snapshot.components;

  const c4List = Object.values(byId).filter(
    (c): c is C4Component => isC4Component(c) && !c.hidden,
  );

  if (c4List.length === 0) {
    throw new Error(
      "No C4 elements to export. Add person, system, container, or component nodes first.",
    );
  }

  const childrenByParent = new Map<string | null, C4Component[]>();
  for (const component of c4List) {
    const parentKey = getEffectiveC4ParentId(component, byId);
    if (!childrenByParent.has(parentKey)) childrenByParent.set(parentKey, []);
    childrenByParent.get(parentKey)!.push(component);
  }

  const roots = childrenByParent.get(null) ?? [];
  const localIdByStructuraId = new Map<string, string>();
  const fullDslByStructuraId = new Map<string, string>();
  assignDslIds(roots, childrenByParent, localIdByStructuraId, fullDslByStructuraId);

  const workspaceTitle = dslQuote(diagram.name);
  const workspaceDesc =
    diagram.description?.trim() ? ` ${dslQuote(diagram.description.trim())}` : "";

  const modelBody =
    emitModelBlock(roots, childrenByParent, localIdByStructuraId) +
    emitRelationships(resolved.snapshot.connections, byId, fullDslByStructuraId);

  const viewsBlock = buildViewsSection(diagram.level, c4List, fullDslByStructuraId);

  return `workspace ${workspaceTitle}${workspaceDesc} {

  !identifiers hierarchical

  model {
${modelBody}  }

${viewsBlock}}
`;

}
