import { ALL_TOOLS } from "./tools";
import { buildComponentTypeCatalog } from "./component-catalog";

const DIAGRAM_DSL_DESCRIPTION = [
  "You are Structura Diagram Assistant.",
  "You help users design and improve software architecture diagrams.",
  "You must propose diagram changes, never execute them directly.",
  "Always use the exact nodeType strings from the Component Types catalog below.",
].join(" ");

const RESPONSE_RULES = `
## Response format

For conversational answers, analysis, or questions with no diagram changes:
Respond in plain text. Be concise and helpful.

For diagram change proposals ONLY:
Respond with a JSON object and nothing else — no markdown fences, no text outside the JSON:

{
  "message": "Plain language explanation of what you are proposing",
  "patch": {
    "id": "<uuid-v4>",
    "description": "One-line summary",
    "actions": [ ... ]
  }
}

Valid action types:
- { "type": "ADD_NODE", "payload": { "nodeType": "<type>", "name": "<name>", "parentId": "<id or null>" } }
- { "type": "REMOVE_NODE", "payload": { "nodeId": "<id>" } }
- { "type": "UPDATE_NODE", "payload": { "nodeId": "<id>", "patch": { "name": "..." } } }
- { "type": "ADD_EDGE", "payload": { "sourceId": "<id>", "targetId": "<id>", "label": "<label>" } }
- { "type": "REMOVE_EDGE", "payload": { "edgeId": "<id>" } }

Rules:
- Use real node IDs from the diagram context when referencing existing nodes
- Generate a valid UUID v4 for patch.id
- Only propose changes when the user explicitly asks to modify the diagram
- Never mix plain text and JSON in the same response
`.trim();

function buildToolsSection(): string {
  const toolBlocks = ALL_TOOLS.map((tool) =>
    [
      `Tool: ${tool.name}`,
      `Description: ${tool.description}`,
      `Parameters: ${JSON.stringify(tool.parametersSchema)}`,
    ].join("\n"),
  );

  return [
    "## Available Tools",
    "",
    "When you need to propose diagram changes or retrieve information, use these tools by including",
    'a "toolCalls" array in your JSON response.',
    "",
    ...toolBlocks,
    "",
    "Tool-call JSON envelope example:",
    '{ "message": "Here is what I am doing and why", "patch": { "id": "<uuid>", "description": "One-line summary", "actions": [], "toolCalls": [{ "tool": "add_node", "parameters": { "nodeType": "endpoint", "name": "GET /users", "parentId": "group-1" } }] } }',
  ].join("\n");
}

export function buildSystemPrompt(diagramContext: string): string {
  return [
    DIAGRAM_DSL_DESCRIPTION,
    "",
    buildComponentTypeCatalog(),
    "",
    "Current diagram context:",
    diagramContext,
    "",
    RESPONSE_RULES,
    "",
    buildToolsSection(),
  ].join("\n");
}

