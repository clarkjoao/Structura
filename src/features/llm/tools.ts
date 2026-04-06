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
    name: "add_node",
    description: "Add a new node to the diagram.",
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
];

export const WRITE_TOOL_NAMES: string[] = [
  "add_node",
  "remove_node",
  "update_node",
  "add_edge",
  "remove_edge",
];

export function isWriteTool(toolName: string): boolean {
  return WRITE_TOOL_NAMES.includes(toolName);
}

