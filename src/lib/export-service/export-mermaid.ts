import type { Flow, Component, Connection } from "@/features/diagram";

export function exportMermaid(
  flows: Flow[],
  _components: Record<string, Component>,
  _connections: Record<string, Connection>,
): string {
  return flows
    .map((flow) => `## ${flow.name}\n\n\`\`\`mermaid\n${flow.mermaid}\n\`\`\``)
    .join("\n\n");
}
