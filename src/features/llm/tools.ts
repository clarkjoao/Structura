import type { LLMTool } from "./types";
import { ARCHITECTURE_TOOLS } from "./tools-architecture";

/**
 * Read tools, pattern insertion and pointwise edits.
 *
 * Generating a diagram goes through `propose_architecture` (see `tools-architecture.ts`):
 * the model sends semantic intent and the layout engine derives geometry. The mutating
 * tools below remain for targeted manual edits after generation — they are no longer the
 * generation path, and `add_node` no longer accepts a position.
 */
export const BASE_TOOLS: LLMTool[] = [
  {
    name: "get_diagram_summary",
    description: "Returns a summary of the current diagram including all nodes and edges.",
    parametersSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_node_details",
    description: "Returns detailed information about a specific node by its ID.",
    parametersSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string", description: "The ID of the node to inspect" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "get_project_metadata",
    description:
      "Returns the project name, description, and external links attached to the diagram.",
    parametersSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_tags",
    description: "Returns all tags used in the current diagram for categorizing nodes.",
    parametersSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_patterns",
    description:
      "Returns all available architectural patterns that can be inserted into the diagram. Use this to help users choose which pattern to add.",
    parametersSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "expand_pattern",
    description:
      "Expand a named pattern into IR nodes and connections, ready to merge into a proposal. " +
      "Returns the generated ids so you can reference them in your IR. " +
      "Pass prefix to avoid id collisions when inserting multiple patterns. " +
      "Pass wiring to connect the pattern entry/exit to existing nodes. " +
      "Example: { pattern: 'circuit-breaker', prefix: 'payment-', tier: 'application' }",
    parametersSchema: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description:
            'Pattern id from list_patterns, e.g. "circuit-breaker", "cqrs", "saga-orchestration".',
        },
        prefix: {
          type: "string",
          description:
            'Prefix for all generated node ids, e.g. "payment-". Prevents collisions when merging multiple patterns.',
        },
        tier: {
          type: "string",
          description:
            'Tier for all pattern components. Defaults to "application".',
        },
        wiring: {
          type: "object",
          description: "Wire the pattern entry (index 0) and exit (last) to existing nodes.",
          properties: {
            entrySource: { type: "string", description: "External node id that connects to the pattern entry." },
            exitTarget: { type: "string", description: "Pattern exit connects to this external node id." },
          },
        },
        reuseExisting: {
          type: "object",
          description:
            "Map of pattern component index to an existing node id — those components are not emitted as new nodes, only their connections.",
        },
      },
      required: ["pattern"],
    },
  },
  {
    name: "add_node",
    description:
      "Add a single node to an existing diagram. For generating a diagram use " +
      "propose_architecture instead. Position is not accepted: Structura places the node.",
    parametersSchema: {
      type: "object",
      properties: {
        nodeType: {
          type: "string",
          description:
            'Must be one of the exact nodeType strings from the Component Types catalog in the system prompt. Examples: "person", "system", "container", "component", "panel", "note", "api-group", "endpoint", "db-table", "json-viewer" or an AWS category type like "aws-networking".',
        },
        name: { type: "string" },
        parentId: { type: ["string", "null"] },
        awsService: {
          type: "string",
          description:
            'Required for AWS node types. The specific AWS service id (e.g. "api-gateway", "rds", "elb", "s3"). Must match a service id from the AWS catalog.',
        },
      },
      required: ["nodeType", "name", "parentId"],
    },
  },
  {
    name: "remove_node",
    description: "Remove an existing node by ID.",
    parametersSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
      },
      required: ["nodeId"],
    },
  },
  {
    name: "update_node",
    description: "Update properties of an existing node.",
    parametersSchema: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        patch: { type: "object" },
      },
      required: ["nodeId", "patch"],
    },
  },
  {
    name: "add_edge",
    description: "Add a connection between two nodes.",
    parametersSchema: {
      type: "object",
      properties: {
        sourceId: { type: "string" },
        targetId: { type: "string" },
        label: { type: "string" },
        edgeStyle: { type: "string" },
        patch: { type: "object" },
      },
      required: ["sourceId", "targetId", "label"],
    },
  },
  {
    name: "remove_edge",
    description: "Remove an existing connection by ID.",
    parametersSchema: {
      type: "object",
      properties: {
        edgeId: { type: "string" },
      },
      required: ["edgeId"],
    },
  },
  {
    name: "insert_pattern",
    description:
      "Insert an architectural pattern into the diagram by its ID. Use list_patterns first to see available options. Returns the IDs of all created nodes.",
    parametersSchema: {
      type: "object",
      properties: {
        patternId: {
          type: "string",
          description:
            'The pattern ID from the patterns catalog (e.g. "circuit-breaker", "cqrs", "fifo-queue-aws", "retry-with-fallback", "saga-orchestration")',
        },
      },
      required: ["patternId"],
    },
  },
  {
    name: "auto_layout",
    description:
      "Re-arrange an existing diagram with the generic ELK algorithm. Only use this when " +
      "the user explicitly asks for it. It is not the generation path and not a fallback: " +
      "if propose_architecture reports problems, fix the IR with refine_architecture rather " +
      "than reaching for this, which ignores tiers, boundaries and the primary path.",
    parametersSchema: { type: "object", properties: {}, required: [] },
  },
];

export const ALL_TOOLS: LLMTool[] = [...ARCHITECTURE_TOOLS, ...BASE_TOOLS];

export const WRITE_TOOL_NAMES: string[] = [
  "commit_architecture",
  "add_node",
  "remove_node",
  "update_node",
  "add_edge",
  "remove_edge",
  "insert_pattern",
  "auto_layout",
];

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOL_NAMES.includes(toolName);
}
