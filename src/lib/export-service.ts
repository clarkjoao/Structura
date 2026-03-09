import type { Diagram, Flow, Component, Connection } from "@/features/diagram";

export function exportJSON(diagram: Diagram): string {
  return JSON.stringify(diagram, null, 2);
}

export function exportDrawio(diagram: Diagram): string {
  const escXml = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const cells = [
    `<mxCell id="0"/><mxCell id="1" parent="0"/>`,
    ...diagram.nodeLayouts.map((nl) => {
      const c = diagram.snapshot.components[nl.elementId];
      if (!c) return "";
      const isPanel = c.type === "panel";
      const parent = c.parentId ?? "1";
      const style = isPanel
        ? "swimlane;fillColor=none;dashed=1;"
        : "rounded=1;fillColor=#1e1e2e;fontColor=#ffffff;";
      return `<mxCell id="${escXml(c.id)}" value="${escXml(c.name)}" style="${style}" vertex="1" parent="${escXml(parent)}"><mxGeometry x="${nl.x}" y="${nl.y}" width="${c.width ?? 180}" height="${c.height ?? 80}" as="geometry"/></mxCell>`;
    }),
    ...Object.values(diagram.snapshot.connections).map((conn) => {
      const parts: string[] = [];
      parts.push(
        conn.edgeStyle === "bezier"
          ? "straightEdgeStyle;curved=1"
          : conn.edgeStyle === "step" || conn.edgeStyle === "smoothstep"
            ? "orthogonalEdgeStyle"
            : "straightEdgeStyle",
      );
      if (conn.strokeStyle === "dashed") parts.push("dashed=1", "dashPattern=8 4");
      else if (conn.strokeStyle === "dotted") parts.push("dashed=1", "dashPattern=2 4");
      parts.push(
        conn.markerEnd === "none"
          ? "endArrow=none"
          : conn.markerEnd === "arrow"
            ? "endArrow=classicThin"
            : "endArrow=blockThin",
      );
      if (conn.markerStart && conn.markerStart !== "none")
        parts.push(
          conn.markerStart === "arrow" ? "startArrow=classicThin" : "startArrow=blockThin",
        );
      if (conn.strokeWidth != null && conn.strokeWidth !== 1)
        parts.push(`strokeWidth=${conn.strokeWidth}`);
      const style = parts.join(";");
      return `<mxCell id="${escXml(conn.id)}" value="${escXml(conn.label)}" style="${escXml(style)}" edge="1" source="${escXml(conn.sourceId)}" target="${escXml(conn.targetId)}" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>`;
    }),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?><mxfile><diagram name="${escXml(diagram.name)}"><mxGraphModel><root>${cells.join("")}</root></mxGraphModel></diagram></mxfile>`;
}

export function exportMermaid(
  flows: Flow[],
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): string {
  return flows
    .map((flow) => `## ${flow.name}\n\n\`\`\`mermaid\n${flow.mermaid}\n\`\`\``)
    .join("\n\n");
}

export function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
