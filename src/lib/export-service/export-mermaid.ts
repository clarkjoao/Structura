import { stepsToMermaid, type Flow, type Component, type Connection } from "@/features/diagram";

export function exportMermaid(
  flows: Flow[],
  components: Record<string, Component>,
  connections: Record<string, Connection>,
): string {
  return flows
    .map((flow) => {
      const mermaid = stepsToMermaid(flow, components, connections);
      return `## ${flow.name}\n\n\`\`\`mermaid\n${mermaid}\n\`\`\``;
    })
    .join("\n\n");
}
