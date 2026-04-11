import type { C4Type, Component, Connection, NodeLayout, UnknownComponent } from "@/features/diagram";
import {
  COMPONENT_TYPE_UNKNOWN,
  EdgeStyle,
  PanelKind,
  generateId,
} from "@/features/diagram";
import { AWS_CATEGORY_ID_GENERAL } from "@/lib/catalogs/aws";

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
  const cell =
    el.tagName.toLowerCase() === "object" ? el.querySelector("mxCell") : el;
  return cell?.getAttribute("style") ?? "";
}

function extractGeometry(el: Element): { x: number; y: number; width: number; height: number } {
  const geom =
    el.querySelector("mxGeometry") ?? el.querySelector("mxCell > mxGeometry");
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
  return EdgeStyle.Smoothstep;
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

function resolveRegistryServiceId(
  registryServiceName: string,
  serviceRegistry: Record<string, { id: string; name: string }>,
): string | undefined {
  const trimmed = registryServiceName.trim();
  if (!trimmed) return undefined;
  const matched = Object.values(serviceRegistry).find(
    (service) => service.name.toLowerCase() === trimmed.toLowerCase(),
  );
  return matched?.id;
}

interface PendingVertex {
  drawioId: string;
  kind: "c4" | "panel" | "aws" | "panel-mxcell" | "unknown";
  parentDrawioId: string;
  rawGeometry: { x: number; y: number; width: number; height: number };
  
  sourceElement: Element;
}

function isRootParentDrawioId(parentDrawioId: string): boolean {
  return parentDrawioId === "0" || parentDrawioId === "1" || parentDrawioId === "";
}

export function parseDrawioXml(
  xml: string,
  pasteCenter: { x: number; y: number },
  serviceRegistry: Record<string, { id: string; name: string }>,
): DrawioImportResult {
  let document: Document;
  try {
    const fragment = extractMxGraphModelFragment(xml);
    document = new DOMParser().parseFromString(fragment, "text/xml");
    if (isParseErrorDocument(document)) {
      return { ...EMPTY_RESULT };
    }
  } catch {
    return { ...EMPTY_RESULT };
  }

  const skipped: string[] = [];
  const idMap = new Map<string, string>();
  const pendingVertices: PendingVertex[] = [];
  const innerMxCellsFromObjects = new Set<Element>();

  const objectNodes = document.getElementsByTagName("object");
  for (let index = 0; index < objectNodes.length; index += 1) {
    const objectEl = objectNodes[index]!;
    const c4TypeLabel = getAttr(objectEl, "c4Type");
    if (!c4TypeLabel) continue;

    const drawioId = getAttr(objectEl, "id");
    if (!drawioId) {
      skipped.push("object:missing-id");
      continue;
    }

    const vertexCell = getVertexMxCellFromObject(objectEl);
    if (!vertexCell) {
      pendingVertices.push({
        drawioId,
        kind: "unknown",
        parentDrawioId: "1",
        rawGeometry: readGeometry(objectEl),
        sourceElement: objectEl,
      });
      continue;
    }
    innerMxCellsFromObjects.add(vertexCell);

    const parentDrawioId = getAttr(vertexCell, "parent");
    const rawGeometry = readGeometry(vertexCell);

    if (c4TypeLabel === "SystemScopeBoundary") {
      pendingVertices.push({
        drawioId,
        kind: "panel",
        parentDrawioId,
        rawGeometry,
        sourceElement: objectEl,
      });
      continue;
    }

    const mappedC4Type = C4_TYPE_MAP[c4TypeLabel];
    if (mappedC4Type) {
      pendingVertices.push({
        drawioId,
        kind: "c4",
        parentDrawioId,
        rawGeometry,
        sourceElement: objectEl,
      });
      continue;
    }

    pendingVertices.push({
      drawioId,
      kind: "unknown",
      parentDrawioId,
      rawGeometry,
      sourceElement: objectEl,
    });
  }

  const mxCellNodes = document.getElementsByTagName("mxCell");
  for (let index = 0; index < mxCellNodes.length; index += 1) {
    const mxCell = mxCellNodes[index]!;
    const cellId = getAttr(mxCell, "id");
    if (cellId === "0" || cellId === "1") continue;

    if (isEdgeMxCell(mxCell)) {
      continue;
    }

    if (!isVertexMxCell(mxCell)) {
      continue;
    }

    if (innerMxCellsFromObjects.has(mxCell)) {
      continue;
    }

    const style = getAttr(mxCell, "style");

    if (styleHasDashedBorder(style)) {
      const ancestorObject = closestObjectAncestor(mxCell);
      if (ancestorObject && getAttr(ancestorObject, "c4Type") === "SystemScopeBoundary") {
        continue;
      }
      if (!cellId) {
        skipped.push("panel:missing-id");
        continue;
      }
      pendingVertices.push({
        drawioId: cellId,
        kind: "panel-mxcell",
        parentDrawioId: getAttr(mxCell, "parent"),
        rawGeometry: readGeometry(mxCell),
        sourceElement: mxCell,
      });
      continue;
    }

    if (styleHasAwsProductIcon(style)) {
      if (!cellId) {
        skipped.push("aws:missing-id");
        continue;
      }
      pendingVertices.push({
        drawioId: cellId,
        kind: "aws",
        parentDrawioId: getAttr(mxCell, "parent"),
        rawGeometry: readGeometry(mxCell),
        sourceElement: mxCell,
      });
      continue;
    }

    if (!cellId) {
      continue;
    }
    pendingVertices.push({
      drawioId: cellId,
      kind: "unknown",
      parentDrawioId: getAttr(mxCell, "parent"),
      rawGeometry: readGeometry(mxCell),
      sourceElement: mxCell,
    });
  }

  for (const pending of pendingVertices) {
    idMap.set(pending.drawioId, generateId("el"));
  }

  const rootRawPositions: Array<{ x: number; y: number }> = [];
  for (const pending of pendingVertices) {
    if (isRootParentDrawioId(pending.parentDrawioId)) {
      rootRawPositions.push({ x: pending.rawGeometry.x, y: pending.rawGeometry.y });
    }
  }

  let offsetX = 0;
  let offsetY = 0;
  if (rootRawPositions.length > 0) {
    const minX = Math.min(...rootRawPositions.map((position) => position.x));
    const minY = Math.min(...rootRawPositions.map((position) => position.y));
    offsetX = pasteCenter.x - minX;
    offsetY = pasteCenter.y - minY;
  }

  function mapParentId(parentDrawioId: string): string | null {
    if (isRootParentDrawioId(parentDrawioId)) return null;
    const mapped = idMap.get(parentDrawioId);
    return mapped ?? null;
  }

  function layoutPositionFor(
    parentDrawioId: string,
    raw: { x: number; y: number; width: number; height: number },
  ): { x: number; y: number; width: number; height: number } {
    const applyOffset = isRootParentDrawioId(parentDrawioId);
    return {
      x: raw.x + (applyOffset ? offsetX : 0),
      y: raw.y + (applyOffset ? offsetY : 0),
      width: raw.width,
      height: raw.height,
    };
  }

  const components: Component[] = [];
  const layouts: NodeLayout[] = [];

  for (const pending of pendingVertices) {
    const newId = idMap.get(pending.drawioId)!;
    const parentId = mapParentId(pending.parentDrawioId);
    const positioned = layoutPositionFor(pending.parentDrawioId, pending.rawGeometry);

    if (pending.kind === "panel" || pending.kind === "panel-mxcell") {
      const objectEl =
        pending.kind === "panel" ? pending.sourceElement : null;
      const mxCellEl =
        pending.kind === "panel-mxcell" ? pending.sourceElement : getVertexMxCellFromObject(pending.sourceElement);

      const name =
        objectEl && getAttr(objectEl, "c4Name").length > 0
          ? getAttr(objectEl, "c4Name")
          : mxCellEl
            ? getAttr(mxCellEl, "value")
            : "";

      components.push({
        id: newId,
        name,
        description: "",
        parentId,
        type: "panel",
        panelKind: PanelKind.Default,
      });
      layouts.push({
        elementId: newId,
        x: positioned.x,
        y: positioned.y,
        width: positioned.width || undefined,
        height: positioned.height || undefined,
      });
      continue;
    }

    if (pending.kind === "aws") {
      const mxCellEl = pending.sourceElement;
      const style = getAttr(mxCellEl, "style");
      const awsService = extractAwsServiceFromStyle(style);
      const name = getAttr(mxCellEl, "value") || (awsService ?? "AWS");

      components.push({
        id: newId,
        name,
        description: "",
        parentId,
        type: AWS_CATEGORY_ID_GENERAL,
        ...(awsService ? { awsService } : {}),
      });
      layouts.push({
        elementId: newId,
        x: positioned.x,
        y: positioned.y,
        width: positioned.width || undefined,
        height: positioned.height || undefined,
      });
      continue;
    }

    if (pending.kind === "c4") {
      const objectEl = pending.sourceElement;
      const c4TypeLabel = getAttr(objectEl, "c4Type");
      const mappedType = C4_TYPE_MAP[c4TypeLabel] as "person" | "system" | "container" | "component";
      const registryServiceName = getAttr(objectEl, "registryService");
      const serviceId = resolveRegistryServiceId(registryServiceName, serviceRegistry);

      components.push({
        id: newId,
        name: getAttr(objectEl, "c4Name") || "Unnamed",
        description: getAttr(objectEl, "c4Description"),
        parentId,
        type: mappedType,
        technology: getAttr(objectEl, "c4Technology") || undefined,
        ...(serviceId ? { serviceId } : {}),
      });
      layouts.push({
        elementId: newId,
        x: positioned.x,
        y: positioned.y,
        width: positioned.width || undefined,
        height: positioned.height || undefined,
      });
      continue;
    }

    if (pending.kind === "unknown") {
      const sourceEl = pending.sourceElement;
      const conversion = tryConvertUnknownCell(sourceEl);
      const fallbackGeom = extractGeometry(sourceEl);
      const layoutWidth =
        positioned.width > 0 ? positioned.width : fallbackGeom.width;
      const layoutHeight =
        positioned.height > 0 ? positioned.height : fallbackGeom.height;

      if (conversion.kind === "c4") {
        const base = {
          id: newId,
          name: conversion.name,
          description: conversion.description,
          parentId,
          type: conversion.componentType,
        };
        components.push(
          conversion.technology !== undefined
            ? { ...base, technology: conversion.technology }
            : base,
        );
        layouts.push({
          elementId: newId,
          x: positioned.x,
          y: positioned.y,
          width: positioned.width || undefined,
          height: positioned.height || undefined,
        });
      } else if (conversion.kind === "aws") {
        components.push({
          id: newId,
          name: conversion.name,
          description: "",
          parentId,
          type: AWS_CATEGORY_ID_GENERAL,
          ...(conversion.awsService ? { awsService: conversion.awsService } : {}),
        });
        layouts.push({
          elementId: newId,
          x: positioned.x,
          y: positioned.y,
          width: positioned.width || undefined,
          height: positioned.height || undefined,
        });
      } else {
        const unknownComp: UnknownComponent = {
          id: newId,
          name: conversion.name,
          description: "",
          parentId,
          type: COMPONENT_TYPE_UNKNOWN,
          ...(conversion.rawContent.length > 0 ? { rawContent: conversion.rawContent } : {}),
        };
        components.push(unknownComp);
        layouts.push({
          elementId: newId,
          x: positioned.x,
          y: positioned.y,
          width: layoutWidth,
          height: layoutHeight,
        });
      }
    }
  }

  const connections: Connection[] = [];

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

    const style = getAttr(mxCell, "style");
    const edgeStyle = resolveEdgeStyle(style);
    const label = getAttr(mxCell, "value");

    connections.push({
      id: newConnId,
      sourceId,
      targetId,
      label,
      style: { edgeStyle },
    });
  }

  return { components, connections, layouts, skipped };
}
