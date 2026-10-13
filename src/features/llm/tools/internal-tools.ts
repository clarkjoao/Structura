import { z } from "zod";
import {
  isSharedRefComponent,
  type Component,
  type ComponentPatch,
  type Connection,
  type Diagram,
} from "@/features/diagram";
import { isPatternProvider } from "@/features/elements/patterns";
import { validateAddNodeAgainstRegistry } from "../add-node-validation";
import { isKnownNodeType, isValidPatternId } from "../component-catalog";
import { listElementFamilies, searchElements } from "../element-catalog-query";
import { listPatterns } from "../pattern-catalog-query";
import {
  defineTool,
  toolError,
  ToolRegistry,
  type ToolContext,
  type ToolDefinition,
} from "./registry";

/**
 * Tool descriptions are LLM-facing English. Results are plain JSON objects:
 * the SDK sends them to the model JSON-encoded, so names and labels from the
 * diagram reach it as quoted data, never as prose it could read as orders.
 */

const QUEUED_NOTE = "Queued for user review; not applied yet.";

function noDiagram() {
  return toolError("No diagram is open.");
}

function visibleComponents(diagram: Diagram): Component[] {
  return Object.values(diagram.snapshot.components).filter(
    (component) => !isSharedRefComponent(component),
  );
}

function stringField(component: Component, key: "technology" | "description"): string | undefined {
  const value: unknown = key in component ? Reflect.get(component, key) : undefined;
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function summarizeNode(component: Component) {
  return {
    id: component.id,
    type: component.type,
    name: component.name,
    parentId: component.parentId ?? null,
    ...(stringField(component, "technology")
      ? { technology: stringField(component, "technology") }
      : {}),
  };
}

function summarizeEdge(connection: Connection) {
  return {
    id: connection.id,
    sourceId: connection.sourceId,
    targetId: connection.targetId,
    label: connection.label,
  };
}

/** True when `id` names a node already on the diagram or one queued this turn. */
function isKnownNodeRef(id: string, context: ToolContext, diagram: Diagram): boolean {
  return id in diagram.snapshot.components || context.suggestion.hasRef(id);
}

// ─── Read tools ────────────────────────────────────────────────────────────────

const getDiagramSummary = defineTool({
  name: "get_diagram_summary",
  description:
    "Returns the open diagram: its name and level, every node (id, type, name, parentId, technology) and every edge (id, sourceId, targetId, label).",
  inputSchema: z.object({}),
  kind: "read",
  source: "internal",
  execute: (_input, { host }) => {
    const diagram = host.readDiagram();
    if (!diagram) return noDiagram();
    const nodes = visibleComponents(diagram).map(summarizeNode);
    const edges = Object.values(diagram.snapshot.connections).map(summarizeEdge);
    return { name: diagram.name, level: diagram.level, nodes, edges };
  },
});

const getNodeDetails = defineTool({
  name: "get_node_details",
  description:
    "Returns every stored field of one node, plus its incoming and outgoing edges. Use ids from get_diagram_summary or the diagram context.",
  inputSchema: z.object({ nodeId: z.string().describe("The id of the node to inspect") }),
  kind: "read",
  source: "internal",
  execute: ({ nodeId }, { host }) => {
    const diagram = host.readDiagram();
    if (!diagram) return noDiagram();
    const node = diagram.snapshot.components[nodeId];
    if (!node) return toolError(`Unknown node id ${JSON.stringify(nodeId)}.`);
    const edges = Object.values(diagram.snapshot.connections);
    return {
      node,
      incoming: edges.filter((edge) => edge.targetId === nodeId).map(summarizeEdge),
      outgoing: edges.filter((edge) => edge.sourceId === nodeId).map(summarizeEdge),
    };
  },
});

const getProjectMetadata = defineTool({
  name: "get_project_metadata",
  description:
    "Returns the diagram's name, description, domain and C4 level, and the external links attached to its nodes.",
  inputSchema: z.object({}),
  kind: "read",
  source: "internal",
  execute: (_input, { host }) => {
    const diagram = host.readDiagram();
    if (!diagram) return noDiagram();
    const externalLinks = visibleComponents(diagram).flatMap((component) =>
      (component.externalLinks ?? []).map((link) => ({
        nodeId: component.id,
        label: link.label,
        url: link.url,
      })),
    );
    return {
      name: diagram.name,
      description: diagram.description ?? "",
      domain: diagram.domain ?? "",
      level: diagram.level,
      externalLinks,
    };
  },
});

const getTags = defineTool({
  name: "get_tags",
  description:
    "Returns every tag used on the diagram's nodes, with the ids of the nodes that carry it.",
  inputSchema: z.object({}),
  kind: "read",
  source: "internal",
  execute: (_input, { host }) => {
    const diagram = host.readDiagram();
    if (!diagram) return noDiagram();
    const nodeIdsByTag = new Map<string, string[]>();
    for (const component of visibleComponents(diagram)) {
      for (const tag of component.tags ?? []) {
        nodeIdsByTag.set(tag, [...(nodeIdsByTag.get(tag) ?? []), component.id]);
      }
    }
    return { tags: [...nodeIdsByTag].map(([tag, nodeIds]) => ({ tag, nodeIds })) };
  },
});

const listPatternsTool = defineTool({
  name: "list_patterns",
  description:
    "Returns the architectural patterns insert_pattern accepts (id, name, category, description, infrastructure roles) and the providers it accepts.",
  inputSchema: z.object({}),
  kind: "read",
  source: "internal",
  execute: () => listPatterns(),
});

const listElementFamiliesTool = defineTool({
  name: "list_element_families",
  description:
    "Returns the element families (C4, structural shapes, AWS, GCP, Azure, Kubernetes, OSS…) with their categories, and diagramFamilyMix (node counts per family on the open diagram). Services inside a category are not listed: use search_elements.",
  inputSchema: z.object({}),
  kind: "read",
  source: "internal",
  execute: (_input, { host }) => listElementFamilies(host.readDiagram()?.snapshot.components ?? {}),
});

const searchElementsTool = defineTool({
  name: "search_elements",
  description:
    "Searches the element catalog. Returns the exact elementType and serviceId add_node needs. Never invent these values.",
  inputSchema: z.object({
    query: z.string().min(1).describe('Free text, e.g. "cache", "kubernetes deployment"'),
    familyId: z
      .string()
      .optional()
      .describe("Restrict to one family id from list_element_families"),
    categoryId: z.string().optional().describe("Restrict to one category id"),
    limit: z.number().int().min(1).max(50).optional().describe("Max results, default 15"),
  }),
  kind: "read",
  source: "internal",
  execute: (input) => searchElements(input),
});

// ─── Write tools: queue, never mutate ──────────────────────────────────────────

const addNode = defineTool({
  name: "add_node",
  description:
    "Queues a new node. Returns a ref other changes in this reply can use as parentId, sourceId or targetId.",
  inputSchema: z.object({
    nodeType: z
      .string()
      .describe("Exact nodeType from the catalog, or elementType from search_elements"),
    name: z.string().min(1),
    parentId: z
      .string()
      .nullable()
      .describe("Id of an existing container node, a ref from add_node, or null"),
    serviceId: z.string().optional().describe("serviceId from search_elements, for cloud/OSS"),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
  }),
  kind: "write",
  source: "internal",
  execute: ({ nodeType, name, parentId, serviceId, position }, context) => {
    const diagram = context.host.readDiagram();
    if (!diagram) return noDiagram();
    if (!isKnownNodeType(nodeType)) {
      return toolError(
        `Unknown nodeType ${JSON.stringify(nodeType)}. Use search_elements or the catalog.`,
      );
    }
    const registryCheck = validateAddNodeAgainstRegistry(nodeType, serviceId);
    if (!registryCheck.ok) return toolError(registryCheck.reason);
    if (parentId !== null && !isKnownNodeRef(parentId, context, diagram)) {
      return toolError(`Unknown parentId ${JSON.stringify(parentId)}.`);
    }
    const ref = context.suggestion.addNode({
      nodeType,
      name,
      parentId,
      ...(position ? { position } : {}),
      ...(serviceId ? { cloudServiceId: serviceId } : {}),
    });
    return { queued: true, ref, note: QUEUED_NOTE };
  },
});

const removeNode = defineTool({
  name: "remove_node",
  description: "Queues the removal of an existing node by id.",
  inputSchema: z.object({ nodeId: z.string() }),
  kind: "write",
  source: "internal",
  execute: ({ nodeId }, context) => {
    const diagram = context.host.readDiagram();
    if (!diagram) return noDiagram();
    if (!(nodeId in diagram.snapshot.components)) {
      return toolError(`Unknown node id ${JSON.stringify(nodeId)}.`);
    }
    context.suggestion.queue({ type: "REMOVE_NODE", payload: { nodeId } });
    return { queued: true, note: QUEUED_NOTE };
  },
});

/**
 * The fields a model may change on an existing node. Strict: any other key is
 * refused, so a patch cannot reach ids, parents, types or layout.
 */
export const UPDATABLE_NODE_FIELDS = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    technology: z.string(),
    tags: z.array(z.string()),
  })
  .partial()
  .strict();

const updateNode = defineTool({
  name: "update_node",
  description:
    "Queues an update to an existing node. patch may only contain: name, description, technology, tags.",
  // `patch` is checked inside `execute` so an invalid patch comes back to the
  // model as a readable error instead of failing the call.
  inputSchema: z.object({ nodeId: z.string(), patch: z.record(z.string(), z.unknown()) }),
  kind: "write",
  source: "internal",
  execute: ({ nodeId, patch }, context) => {
    const diagram = context.host.readDiagram();
    if (!diagram) return noDiagram();
    if (!(nodeId in diagram.snapshot.components)) {
      return toolError(`Unknown node id ${JSON.stringify(nodeId)}.`);
    }
    const parsed = UPDATABLE_NODE_FIELDS.safeParse(patch);
    if (!parsed.success) {
      return toolError(
        `Invalid patch: ${parsed.error.issues.map((issue) => issue.message).join("; ")}. Allowed fields: name, description, technology, tags.`,
      );
    }
    if (Object.keys(parsed.data).length === 0) {
      return toolError("Empty patch: give at least one of name, description, technology, tags.");
    }
    // Typed assignment: fails to compile if a field above stops being a valid
    // component patch in the domain.
    const componentPatch: ComponentPatch = parsed.data;
    context.suggestion.queue({ type: "UPDATE_NODE", payload: { nodeId, patch: componentPatch } });
    return { queued: true, note: QUEUED_NOTE };
  },
});

const addEdge = defineTool({
  name: "add_edge",
  description:
    "Queues a connection from sourceId to targetId (existing node ids or refs from add_node).",
  inputSchema: z.object({
    sourceId: z.string(),
    targetId: z.string(),
    label: z.string().describe('Short label, e.g. "HTTPS", "reads/writes"; "" if unsure'),
  }),
  kind: "write",
  source: "internal",
  execute: ({ sourceId, targetId, label }, context) => {
    const diagram = context.host.readDiagram();
    if (!diagram) return noDiagram();
    for (const [role, id] of [
      ["sourceId", sourceId],
      ["targetId", targetId],
    ] as const) {
      if (!isKnownNodeRef(id, context, diagram))
        return toolError(`Unknown ${role} ${JSON.stringify(id)}.`);
    }
    context.suggestion.queue({ type: "ADD_EDGE", payload: { sourceId, targetId, label } });
    return { queued: true, note: QUEUED_NOTE };
  },
});

const removeEdge = defineTool({
  name: "remove_edge",
  description: "Queues the removal of an existing edge by id.",
  inputSchema: z.object({ edgeId: z.string() }),
  kind: "write",
  source: "internal",
  execute: ({ edgeId }, context) => {
    const diagram = context.host.readDiagram();
    if (!diagram) return noDiagram();
    if (!(edgeId in diagram.snapshot.connections)) {
      return toolError(`Unknown edge id ${JSON.stringify(edgeId)}.`);
    }
    context.suggestion.queue({ type: "REMOVE_EDGE", payload: { edgeId } });
    return { queued: true, note: QUEUED_NOTE };
  },
});

const insertPattern = defineTool({
  name: "insert_pattern",
  description:
    'Queues an architectural pattern by id (see list_patterns). provider: "neutral" (default) or a cloud family id such as "aws", "gcp", "azure"; match the provider already used in the diagram.',
  inputSchema: z.object({ patternId: z.string(), provider: z.string().optional() }),
  kind: "write",
  source: "internal",
  execute: ({ patternId, provider }, context) => {
    if (!isValidPatternId(patternId)) {
      return toolError(`Unknown patternId ${JSON.stringify(patternId)}. Use list_patterns.`);
    }
    if (provider !== undefined && !isPatternProvider(provider)) {
      return toolError(
        `Unknown provider ${JSON.stringify(provider)}. Use list_patterns for the accepted ones.`,
      );
    }
    context.suggestion.queue({
      type: "INSERT_PATTERN",
      payload: { patternId, ...(provider ? { provider } : {}) },
    });
    return { queued: true, note: QUEUED_NOTE };
  },
});

const autoLayout = defineTool({
  name: "auto_layout",
  description: "Queues an automatic layout of the whole diagram, applied after the other changes.",
  inputSchema: z.object({}),
  kind: "write",
  source: "internal",
  execute: (_input, context) => {
    context.suggestion.queue({ type: "AUTO_LAYOUT", payload: {} });
    return { queued: true, note: QUEUED_NOTE };
  },
});

export const INTERNAL_TOOLS: readonly ToolDefinition[] = [
  getDiagramSummary,
  getNodeDetails,
  getProjectMetadata,
  getTags,
  listPatternsTool,
  listElementFamiliesTool,
  searchElementsTool,
  addNode,
  removeNode,
  updateNode,
  addEdge,
  removeEdge,
  insertPattern,
  autoLayout,
];

/** A registry holding the internal tools. MCP tools register into the same kind of registry later. */
export function createInternalToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  for (const tool of INTERNAL_TOOLS) registry.register(tool);
  return registry;
}
