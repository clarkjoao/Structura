import type {
  AwsComponent,
  C4Type,
  Component,
  Connection,
  NodeLayout,
  UnknownComponent,
} from "@/features/diagram";
import { COMPONENT_TYPE_UNKNOWN, EdgeStyle, PanelKind, generateId } from "@/features/diagram";
import { cloudServiceIdWrite } from "@/features/diagram/model/cloud-service-id";
import {
  AWS_CATEGORY_ID_GENERAL,
  isAwsType,
  type AwsCategoryId,
} from "@/features/cloud/providers/aws/aws.catalog";
import { allElements } from "@/features/elements/element.registry";

export interface DrawioImportResult {
  components: Component[];
  connections: Connection[];
  layouts: NodeLayout[];
  skipped: string[];
}

const C4_TYPE_MAP: Record<string, string> = {
  Person: "person",
  "Software System": "system",
  Container: "container",
  Component: "component",
};

const EDGE_STYLE_MAP: Array<[string, EdgeStyle]> = [
  ["edgeStyle=none", EdgeStyle.Straight],
  ["edgeStyle=orthogonalEdgeStyle", EdgeStyle.Step],
  ["edgeStyle=entityRelationEdgeStyle", EdgeStyle.Bezier],
];

const EMPTY_RESULT: DrawioImportResult = {
  components: [],
  connections: [],
  layouts: [],
  skipped: [],
};

const MXGRAPH_MODEL_RE = /<mxGraphModel\b[\s\S]*?<\/mxGraphModel>/;

function extractMxGraphModelFragment(xml: string): string {
  const match = xml.match(MXGRAPH_MODEL_RE);
  return match ? match[0] : xml;
}

function isParseErrorDocument(doc: Document): boolean {
  return doc.getElementsByTagName("parsererror").length > 0;
}

function getAttr(element: Element, name: string): string {
  return element.getAttribute(name) ?? "";
}

function parseNumber(value: string, fallback = 0): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readGeometry(element: Element): { x: number; y: number; width: number; height: number } {
  const geometry = element.querySelector("mxGeometry");
  if (!geometry) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: parseNumber(getAttr(geometry, "x")),
    y: parseNumber(getAttr(geometry, "y")),
    width: parseNumber(getAttr(geometry, "width")),
    height: parseNumber(getAttr(geometry, "height")),
  };
}

function extractStyle(el: Element): string {
  const cell = el.tagName.toLowerCase() === "object" ? el.querySelector("mxCell") : el;
  return cell?.getAttribute("style") ?? "";
}

function extractGeometry(el: Element): { x: number; y: number; width: number; height: number } {
  const geom = el.querySelector("mxGeometry") ?? el.querySelector("mxCell > mxGeometry");
  return {
    x: parseFloat(geom?.getAttribute("x") ?? "0"),
    y: parseFloat(geom?.getAttribute("y") ?? "0"),
    width: parseFloat(geom?.getAttribute("width") ?? "240"),
    height: parseFloat(geom?.getAttribute("height") ?? "120"),
  };
}

type ConversionResult =
  | {
      kind: "c4";
      componentType: C4Type;
      name: string;
      description: string;
      technology?: string;
    }
  | { kind: "aws"; name: string; awsService: string }
  | { kind: "unknown"; name: string; rawContent: string };

function plainTextLabelFromElement(el: Element): string {
  if (el.tagName.toLowerCase() === "object") {
    const fromLabel = stripHtmlTags(getAttr(el, "label"));
    const fromValue = stripHtmlTags(getAttr(el, "value"));
    const c4Name = getAttr(el, "c4Name").trim();
    const vertexCell = getVertexMxCellFromObject(el);
    const fromCell = vertexCell ? stripHtmlTags(getAttr(vertexCell, "value")) : "";
    return (fromLabel || fromValue || c4Name || fromCell).trim();
  }
  return (stripHtmlTags(getAttr(el, "label")) || stripHtmlTags(getAttr(el, "value"))).trim();
}

function tryConvertUnknownCell(el: Element): ConversionResult {
  const style = extractStyle(el);
  const name = plainTextLabelFromElement(el);

  if (style.includes("shape=umlActor")) {
    return {
      kind: "c4",
      componentType: "person",
      name: name || "Person",
      description: "",
    };
  }

  if (style.includes("shape=mxgraph.aws4.productIcon")) {
    const m = style.match(/prIcon=mxgraph\.aws4\.(\w+)/);
    const iconName = m?.[1] ?? "";
    return {
      kind: "aws",
      name: name || iconName || "AWS",
      awsService: iconName,
    };
  }

  const aws3 = style.match(/shape=mxgraph\.aws3\.(\w+)/);
  if (aws3) {
    const iconName = aws3[1];
    return {
      kind: "aws",
      name: name || iconName,
      awsService: iconName,
    };
  }

  const shape = style.match(/shape=([\w.]+)/);
  if (shape) {
    return {
      kind: "c4",
      componentType: "component",
      name: name || shape[1],
      description: "",
      technology: shape[1],
    };
  }

  const rawForUnknown =
    el.tagName.toLowerCase() === "object"
      ? unknownRawContent(el)
      : getAttr(el, "label") || getAttr(el, "value") || style;

  return {
    kind: "unknown",
    name: name || "Unknown",
    rawContent: rawForUnknown.slice(0, 1000),
  };
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, "").trim();
}

function unknownRawContent(element: Element): string {
  if (element.tagName.toLowerCase() === "object") {
    const label = getAttr(element, "label");
    const vertexCell = getVertexMxCellFromObject(element);
    const value = vertexCell ? getAttr(vertexCell, "value") : "";
    const style = vertexCell ? getAttr(vertexCell, "style") : "";
    return label || value || style || "";
  }
  return getAttr(element, "label") || getAttr(element, "value") || getAttr(element, "style") || "";
}

function resolveEdgeStyle(style: string): EdgeStyle {
  for (const [token, edgeStyle] of EDGE_STYLE_MAP) {
    if (style.includes(token)) {
      return edgeStyle;
    }
  }
  return EdgeStyle.EditableStep;
}

function styleHasDashedBorder(style: string): boolean {
  return style.includes("dashed=1");
}

function styleHasAwsProductIcon(style: string): boolean {
  return style.includes("shape=mxgraph.aws4.productIcon");
}

function extractAwsServiceFromStyle(style: string): string | undefined {
  const match = /prIcon=mxgraph\.aws4\.(\w+)/.exec(style);
  return match ? match[1] : undefined;
}

/**
 * Resolve the AWS category type for an imported service via the element registry.
 *
 * Falls back to `aws-general` when the service id is missing or not owned by any
 * registered AWS category (mxgraph icon names that are not catalog service ids).
 */
function resolveAwsCategoryType(awsService: string | undefined): AwsCategoryId {
  if (!awsService) return AWS_CATEGORY_ID_GENERAL;
  for (const element of allElements()) {
    if (element.family !== "aws") continue;
    const hit = element.palette.variants?.some(
      (variant) => variant.createOptions.serviceId === awsService,
    );
    if (hit && isAwsType(element.id)) return element.id;
  }
  return AWS_CATEGORY_ID_GENERAL;
}

function isEdgeMxCell(mxCell: Element): boolean {
  const id = getAttr(mxCell, "id");
  if (id === "0" || id === "1") return false;
  return (
    getAttr(mxCell, "edge") === "1" &&
    getAttr(mxCell, "source").length > 0 &&
    getAttr(mxCell, "target").length > 0
  );
}

function isVertexMxCell(mxCell: Element): boolean {
  return getAttr(mxCell, "vertex") === "1";
}

function closestObjectAncestor(element: Element | null): Element | null {
  let current: Element | null = element;
  while (current) {
    if (current.tagName.toLowerCase() === "object") {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function getVertexMxCellFromObject(objectEl: Element): Element | null {
  for (const child of objectEl.children) {
    if (child.tagName.toLowerCase() === "mxcell" && isVertexMxCell(child)) {
      return child;
    }
  }
  return null;
}

function resolveServiceIdByName(
  registryServiceName: string,
  services: Record<string, { id: string; name: string }>,
): string | undefined {
  const trimmed = registryServiceName.trim();
  if (!trimmed) return undefined;
  const matched = Object.values(services).find(
    (service) => service.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return matched?.id;
}

/** A shared element's mode and hidden consumers, as Structura exported them. */
function readShared(objectEl: Element): { mode: "badge" | "ref"; consumers: string[] } | null {
  const mode = getAttr(objectEl, "structuraShared");
  if (mode !== "badge" && mode !== "ref") return null;
  const consumers = getAttr(objectEl, "structuraConsumers")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  return { mode, consumers };
}

interface PendingVertex {
  drawioId: string;
  kind: "c4" | "panel" | "aws" | "panel-mxcell" | "shared-ref" | "unknown";
  parentDrawioId: string;
  rawGeometry: { x: number; y: number; width: number; height: number };

  sourceElement: Element;
}

function isRootParentDrawioId(parentDrawioId: string): boolean {
  return parentDrawioId === "0" || parentDrawioId === "1" || parentDrawioId === "";
}

interface CollectContext {
  pendingVertices: PendingVertex[];
  skipped: string[];
  /** The mxCells that belong to an `<object>`: the object already stands for them. */
  innerMxCellsFromObjects: Set<Element>;
}

type RawGeometry = PendingVertex["rawGeometry"];

function pendingVertex(
  drawioId: string,
  kind: PendingVertex["kind"],
  parentDrawioId: string,
  rawGeometry: RawGeometry,
  sourceElement: Element,
): PendingVertex {
  return { drawioId, kind, parentDrawioId, rawGeometry, sourceElement };
}

/** The `<object>` wrappers: C4 elements, scope boundaries and shared-element references. */
function collectObjectVertices(document: Document, ctx: CollectContext): void {
  const { pendingVertices, skipped, innerMxCellsFromObjects } = ctx;
  const objectNodes = document.getElementsByTagName("object");
  for (let index = 0; index < objectNodes.length; index += 1) {
    const objectEl = objectNodes[index]!;
    const c4TypeLabel = getAttr(objectEl, "c4Type");
    // A reference to a shared element, as Structura exported it.
    const refOf = getAttr(objectEl, "structuraRefOf");
    if (!c4TypeLabel && refOf) {
      const refCell = getVertexMxCellFromObject(objectEl);
      const refId = getAttr(objectEl, "id");
      if (refCell && refId) {
        innerMxCellsFromObjects.add(refCell);
        pendingVertices.push(
          pendingVertex(
            refId,
            "shared-ref",
            getAttr(refCell, "parent"),
            readGeometry(refCell),
            objectEl,
          ),
        );
      }
      continue;
    }
    if (!c4TypeLabel) continue;

    const drawioId = getAttr(objectEl, "id");
    if (!drawioId) {
      skipped.push("object:missing-id");
      continue;
    }

    const vertexCell = getVertexMxCellFromObject(objectEl);
    if (!vertexCell) {
      pendingVertices.push(
        pendingVertex(drawioId, "unknown", "1", readGeometry(objectEl), objectEl),
      );
      continue;
    }
    innerMxCellsFromObjects.add(vertexCell);

    const parentDrawioId = getAttr(vertexCell, "parent");
    const rawGeometry = readGeometry(vertexCell);
    const kind: PendingVertex["kind"] =
      c4TypeLabel === "SystemScopeBoundary" ? "panel" : C4_TYPE_MAP[c4TypeLabel] ? "c4" : "unknown";
    pendingVertices.push(pendingVertex(drawioId, kind, parentDrawioId, rawGeometry, objectEl));
  }
}

/** The bare `mxCell` vertices: panels, AWS product icons and anything else draw.io drew. */
function collectMxCellVertices(mxCellNodes: HTMLCollectionOf<Element>, ctx: CollectContext): void {
  const { pendingVertices, skipped, innerMxCellsFromObjects } = ctx;
  for (let index = 0; index < mxCellNodes.length; index += 1) {
    const mxCell = mxCellNodes[index]!;
    const cellId = getAttr(mxCell, "id");
    if (cellId === "0" || cellId === "1") continue;
    if (isEdgeMxCell(mxCell) || !isVertexMxCell(mxCell)) continue;
    if (innerMxCellsFromObjects.has(mxCell)) continue;

    const style = getAttr(mxCell, "style");

    // A shared element's badge is a drawing of an edge the object carries, not an element.
    if (style.includes("structuraBadge=1;")) continue;

    const vertexOf = (kind: PendingVertex["kind"]): PendingVertex =>
      pendingVertex(cellId, kind, getAttr(mxCell, "parent"), readGeometry(mxCell), mxCell);

    if (styleHasDashedBorder(style)) {
      const ancestorObject = closestObjectAncestor(mxCell);
      if (ancestorObject && getAttr(ancestorObject, "c4Type") === "SystemScopeBoundary") {
        continue;
      }
      if (!cellId) {
        skipped.push("panel:missing-id");
        continue;
      }
      pendingVertices.push(vertexOf("panel-mxcell"));
      continue;
    }

    if (styleHasAwsProductIcon(style)) {
      if (!cellId) {
        skipped.push("aws:missing-id");
        continue;
      }
      pendingVertices.push(vertexOf("aws"));
      continue;
    }

    if (!cellId) continue;
    pendingVertices.push(vertexOf("unknown"));
  }
}

/** Where the paste lands: root-level vertices are shifted so their top-left sits on the centre. */
function pasteOffsetFor(
  pendingVertices: PendingVertex[],
  pasteCenter: { x: number; y: number },
): { x: number; y: number } {
  const rootRawPositions = pendingVertices
    .filter((pending) => isRootParentDrawioId(pending.parentDrawioId))
    .map((pending) => ({ x: pending.rawGeometry.x, y: pending.rawGeometry.y }));
  if (rootRawPositions.length === 0) return { x: 0, y: 0 };
  const minX = Math.min(...rootRawPositions.map((position) => position.x));
  const minY = Math.min(...rootRawPositions.map((position) => position.y));
  return { x: pasteCenter.x - minX, y: pasteCenter.y - minY };
}

interface BuildContext {
  idMap: Map<string, string>;
  offset: { x: number; y: number };
  services: Record<string, { id: string; name: string }>;
  sharedEdges: Array<{ sourceDrawioId: string; targetId: string }>;
}

interface BuiltVertex {
  component: Component;
  /** Overrides the placed size, for a vertex whose own geometry came back empty. */
  size?: { width: number; height: number };
}

function awsComponentFor(
  newId: string,
  name: string,
  parentId: string | null,
  awsService: string | undefined,
): AwsComponent {
  return {
    id: newId,
    name,
    description: "",
    parentId,
    type: resolveAwsCategoryType(awsService),
    ...cloudServiceIdWrite(awsService),
  };
}

function panelComponentFor(pending: PendingVertex, newId: string, parentId: string | null) {
  const objectEl = pending.kind === "panel" ? pending.sourceElement : null;
  const mxCellEl =
    pending.kind === "panel-mxcell"
      ? pending.sourceElement
      : getVertexMxCellFromObject(pending.sourceElement);

  const name =
    objectEl && getAttr(objectEl, "c4Name").length > 0
      ? getAttr(objectEl, "c4Name")
      : mxCellEl
        ? getAttr(mxCellEl, "value")
        : "";

  return {
    id: newId,
    name,
    description: "",
    parentId,
    type: "panel" as const,
    panelKind: PanelKind.Default,
  };
}

function c4ComponentFor(
  objectEl: Element,
  newId: string,
  parentId: string | null,
  ctx: BuildContext,
): Component {
  const mappedType = C4_TYPE_MAP[getAttr(objectEl, "c4Type")] as
    "person" | "system" | "container" | "component";
  const serviceId = resolveServiceIdByName(getAttr(objectEl, "registryService"), ctx.services);

  const shared = readShared(objectEl);
  if (shared) {
    for (const consumer of shared.consumers) {
      ctx.sharedEdges.push({ sourceDrawioId: consumer, targetId: newId });
    }
  }
  return {
    id: newId,
    name: getAttr(objectEl, "c4Name") || "Unnamed",
    description: getAttr(objectEl, "c4Description"),
    parentId,
    type: mappedType,
    technology: getAttr(objectEl, "c4Technology") || undefined,
    ...(serviceId ? { serviceId } : {}),
    ...(shared ? { shared: { mode: shared.mode } } : {}),
  };
}

function unknownVertexFor(
  sourceEl: Element,
  newId: string,
  parentId: string | null,
  positioned: RawGeometry,
): BuiltVertex {
  const conversion = tryConvertUnknownCell(sourceEl);

  if (conversion.kind === "c4") {
    const base = {
      id: newId,
      name: conversion.name,
      description: conversion.description,
      parentId,
      type: conversion.componentType,
    };
    return {
      component:
        conversion.technology !== undefined ? { ...base, technology: conversion.technology } : base,
    };
  }
  if (conversion.kind === "aws") {
    return { component: awsComponentFor(newId, conversion.name, parentId, conversion.awsService) };
  }

  const fallbackGeom = extractGeometry(sourceEl);
  const unknownComp: UnknownComponent = {
    id: newId,
    name: conversion.name,
    description: "",
    parentId,
    type: COMPONENT_TYPE_UNKNOWN,
    ...(conversion.rawContent.length > 0 ? { rawContent: conversion.rawContent } : {}),
  };
  return {
    component: unknownComp,
    size: {
      width: positioned.width > 0 ? positioned.width : fallbackGeom.width,
      height: positioned.height > 0 ? positioned.height : fallbackGeom.height,
    },
  };
}

function buildVertex(
  pending: PendingVertex,
  newId: string,
  parentId: string | null,
  positioned: RawGeometry,
  ctx: BuildContext,
): BuiltVertex {
  switch (pending.kind) {
    case "panel":
    case "panel-mxcell":
      return { component: panelComponentFor(pending, newId, parentId) };
    case "aws": {
      const awsService = extractAwsServiceFromStyle(getAttr(pending.sourceElement, "style"));
      const name = getAttr(pending.sourceElement, "value") || (awsService ?? "AWS");
      return { component: awsComponentFor(newId, name, parentId, awsService) };
    }
    case "shared-ref":
      // Its original is mapped once every vertex has its new id.
      return {
        component: {
          id: newId,
          name: getAttr(pending.sourceElement, "label") || "ref",
          description: "",
          parentId,
          type: "shared-ref",
          refOf: getAttr(pending.sourceElement, "structuraRefOf"),
        },
      };
    case "c4":
      return { component: c4ComponentFor(pending.sourceElement, newId, parentId, ctx) };
    case "unknown":
      return unknownVertexFor(pending.sourceElement, newId, parentId, positioned);
  }
}

function buildComponents(
  pendingVertices: PendingVertex[],
  ctx: BuildContext,
): { components: Component[]; layouts: NodeLayout[] } {
  const { idMap, offset } = ctx;
  const components: Component[] = [];
  const layouts: NodeLayout[] = [];

  for (const pending of pendingVertices) {
    const newId = idMap.get(pending.drawioId)!;
    const isRoot = isRootParentDrawioId(pending.parentDrawioId);
    const parentId = isRoot ? null : (idMap.get(pending.parentDrawioId) ?? null);
    const raw = pending.rawGeometry;
    const positioned = {
      x: raw.x + (isRoot ? offset.x : 0),
      y: raw.y + (isRoot ? offset.y : 0),
      width: raw.width,
      height: raw.height,
    };

    const built = buildVertex(pending, newId, parentId, positioned, ctx);
    components.push(built.component);
    layouts.push({
      elementId: newId,
      x: positioned.x,
      y: positioned.y,
      width: built.size ? built.size.width : positioned.width || undefined,
      height: built.size ? built.size.height : positioned.height || undefined,
    });
  }
  return { components, layouts };
}

function buildConnections(
  mxCellNodes: HTMLCollectionOf<Element>,
  ctx: BuildContext,
  skipped: string[],
): Connection[] {
  const { idMap, sharedEdges } = ctx;
  const connections: Connection[] = [];
  // The edges a badge-mode element hid in draw.io, back from its consumers.
  for (const edge of sharedEdges) {
    const sourceId = idMap.get(edge.sourceDrawioId);
    if (!sourceId) continue;
    connections.push({ id: generateId("conn"), sourceId, targetId: edge.targetId, label: "" });
  }

  for (let index = 0; index < mxCellNodes.length; index += 1) {
    const mxCell = mxCellNodes[index]!;
    if (!isEdgeMxCell(mxCell)) continue;

    const edgeDrawioId = getAttr(mxCell, "id");
    const sourceDrawio = getAttr(mxCell, "source");
    const targetDrawio = getAttr(mxCell, "target");

    const sourceId = idMap.get(sourceDrawio);
    const targetId = idMap.get(targetDrawio);
    if (!sourceId || !targetId) {
      skipped.push(edgeDrawioId || `edge:${sourceDrawio}->${targetDrawio}`);
      continue;
    }

    const newConnId = generateId("conn");
    if (edgeDrawioId) {
      idMap.set(edgeDrawioId, newConnId);
    }

    connections.push({
      id: newConnId,
      sourceId,
      targetId,
      label: getAttr(mxCell, "value"),
      style: { edgeStyle: resolveEdgeStyle(getAttr(mxCell, "style")) },
    });
  }
  return connections;
}

function parseXmlDocument(xml: string): Document | null {
  try {
    const document = new DOMParser().parseFromString(extractMxGraphModelFragment(xml), "text/xml");
    return isParseErrorDocument(document) ? null : document;
  } catch {
    return null;
  }
}

export function parseDrawioXml(
  xml: string,
  pasteCenter: { x: number; y: number },
  services: Record<string, { id: string; name: string }>,
): DrawioImportResult {
  const document = parseXmlDocument(xml);
  if (!document) return { ...EMPTY_RESULT };

  const collect: CollectContext = {
    pendingVertices: [],
    skipped: [],
    innerMxCellsFromObjects: new Set<Element>(),
  };
  const mxCellNodes = document.getElementsByTagName("mxCell");
  collectObjectVertices(document, collect);
  collectMxCellVertices(mxCellNodes, collect);
  const { pendingVertices, skipped } = collect;

  const idMap = new Map<string, string>();
  for (const pending of pendingVertices) {
    idMap.set(pending.drawioId, generateId("el"));
  }

  const build: BuildContext = {
    idMap,
    offset: pasteOffsetFor(pendingVertices, pasteCenter),
    services,
    sharedEdges: [],
  };
  const { components, layouts } = buildComponents(pendingVertices, build);

  // References point at their originals' new ids.
  for (const component of components) {
    if (component.type === "shared-ref") {
      component.refOf = idMap.get(component.refOf) ?? component.refOf;
    }
  }

  const connections = buildConnections(mxCellNodes, build, skipped);
  return { components, connections, layouts, skipped };
}
