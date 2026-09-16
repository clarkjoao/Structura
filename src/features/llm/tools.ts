import type { LLMTool } from "./types";

export const ALL_TOOLS: LLMTool[] = [
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
    name: "list_element_families",
    description:
      "Returns the element families available in this workspace (C4, structural shapes, " +
      "and cloud/tech families such as AWS, GCP, Azure, Kubernetes, OSS) with their " +
      "categories. Call this first when you are not sure which family fits the request. " +
      "Services inside a category are NOT returned here — use search_elements for those. " +
      "Also returns diagramFamilyMix (node counts per family on the active diagram) for provider disambiguation.",
    parametersSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "search_elements",
    description:
      "Searches the element catalog for services/shapes matching a query, optionally " +
      "restricted to one family or category. Returns the exact elementType and serviceId " +
      "strings required by add_node (pass serviceId as awsService). Never invent these values — always obtain them here.",
    parametersSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: 'Free text, e.g. "cache", "kubernetes deployment", "postgres"',
        },
        familyId: {
          type: "string",
          description: "Optional: restrict to one family id from list_element_families",
        },
        categoryId: {
          type: "string",
          description: "Optional: restrict to one category id",
        },
        limit: {
          type: "number",
          description: "Max results, default 15, max 50",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "add_node",
    description: "Add a new node to the diagram.",
    parametersSchema: {
      type: "object",
      properties: {
        nodeType: {
          type: "string",
          description:
            "Exact nodeType from the Component Types catalog (structural/C4) or from search_elements.elementType for cloud/OSS services.",
        },
        name: { type: "string" },
        parentId: { type: ["string", "null"] },
        awsService: {
          type: "string",
          description:
            'Cloud/OSS service id from search_elements.serviceId (e.g. "lambda", "redis", "deployment"). Mapped onto cloudServiceId on the component.',
        },
        position: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
          },
          required: ["x", "y"],
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
      "Automatically arranges all nodes in the diagram using a clean layout algorithm. Useful when the diagram becomes cluttered.",
    parametersSchema: { type: "object", properties: {}, required: [] },
  },
];

export const WRITE_TOOL_NAMES: string[] = [
  "add_node",
  "remove_node",
  "update_node",
  "add_edge",
  "remove_edge",
  "insert_pattern",
  "auto_layout",
];

/** Catalog discovery tools — executable reads, never confirmation-gated writes. */
export const CATALOG_READ_TOOL_NAMES: string[] = ["list_element_families", "search_elements"];

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOL_NAMES.includes(toolName);
}

export function isCatalogReadTool(toolName: string): boolean {
  return CATALOG_READ_TOOL_NAMES.includes(toolName);
}
