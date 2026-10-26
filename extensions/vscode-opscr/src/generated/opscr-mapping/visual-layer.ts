/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host's src/lib/opscr-mapping, synced via `npm run sync-shared`.
 * Edit the host files and re-sync instead of changing this file.
 */

import type {
  ImporterGraph,
  ImporterGraphComponent,
  ImporterGraphConnection,
} from "./importer-graph";

/**
 * The visual layer: what an opscr workspace imported from draw.io draws but its manifests do not
 * say — boundaries (Cloud, Region, VPC, subnets…), services with no opscr Kind (CDN, WAF,
 * monitoring…), titles and notes, and the edges through them. opscr writes it to
 * `opscr.visual.json`; this module draws it on top of the technical view's importer graph, so the
 * plugin and the VSCode preview draw it the same way.
 */

export const VISUAL_FILE = "opscr.visual.json";

export interface VisualBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisualElement {
  role: "service" | "boundary" | "decoration";
  label: string;
  hint?: string;
  style: string;
  /** Relative to `parent`: a manifest key (`Kind/name`), another visual key, or the page. */
  box: VisualBox;
  parent: string | null;
  /** Boundaries: the keys drawn inside them. */
  members?: string[];
}

export interface VisualEdge {
  id: string;
  from: string | null;
  to: string | null;
  label: string;
  style: string;
  /** The manifest edge (`Kind/a -type-> Kind/b`) this drawn edge is part of. */
  collapsedInto?: string;
}

export interface VisualFile {
  version: 1;
  source: { file: string; page: string };
  elements: Record<string, VisualElement>;
  edges: VisualEdge[];
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isBox = (v: unknown): v is VisualBox =>
  isRecord(v) &&
  isNumber(v["x"]) &&
  isNumber(v["y"]) &&
  isNumber(v["width"]) &&
  isNumber(v["height"]);
const ROLES = new Set(["service", "boundary", "decoration"]);

/** The sidecar's content; entries that are not well-formed are skipped, an unreadable file is null. */
export function parseVisualFile(text: string): VisualFile | null {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(data) || data["version"] !== 1 || !isRecord(data["elements"])) return null;
  const elements: Record<string, VisualElement> = {};
  for (const [key, raw] of Object.entries(data["elements"])) {
    if (
      !isRecord(raw) ||
      typeof raw["role"] !== "string" ||
      !ROLES.has(raw["role"]) ||
      !isBox(raw["box"])
    )
      continue;
    elements[key] = {
      role: raw["role"] as VisualElement["role"],
      label: typeof raw["label"] === "string" ? raw["label"] : "",
      ...(typeof raw["hint"] === "string" ? { hint: raw["hint"] } : {}),
      style: typeof raw["style"] === "string" ? raw["style"] : "",
      box: raw["box"],
      parent: typeof raw["parent"] === "string" ? raw["parent"] : null,
      ...(Array.isArray(raw["members"])
        ? { members: raw["members"].filter((m): m is string => typeof m === "string") }
        : {}),
    };
  }
  const edges: VisualEdge[] = (Array.isArray(data["edges"]) ? data["edges"] : []).flatMap(
    (raw): VisualEdge[] => {
      if (!isRecord(raw) || typeof raw["id"] !== "string") return [];
      const end = (v: unknown) => (typeof v === "string" ? v : null);
      return [
        {
          id: raw["id"],
          from: end(raw["from"]),
          to: end(raw["to"]),
          label: typeof raw["label"] === "string" ? raw["label"] : "",
          style: typeof raw["style"] === "string" ? raw["style"] : "",
          ...(typeof raw["collapsedInto"] === "string"
            ? { collapsedInto: raw["collapsedInto"] }
            : {}),
        },
      ];
    },
  );
  const source = isRecord(data["source"]) ? data["source"] : {};
  return {
    version: 1,
    source: { file: String(source["file"] ?? ""), page: String(source["page"] ?? "") },
    elements,
    edges,
  };
}

interface CatalogService {
  type: string;
  catalogServiceId: string;
}

const svc = (type: string, catalogServiceId: string): CatalogService => ({
  type,
  catalogServiceId,
});

/**
 * opscr's sidecar hints → Structura catalog services. Hints with no entry draw as an unknown
 * component carrying their label. A test pins every id to the catalogs.
 */
export const VISUAL_SERVICES: Readonly<Record<string, CatalogService>> = {
  "aws:cloudfront": svc("aws-networking", "cloudfront"),
  "aws:route53": svc("aws-networking", "route53"),
  "aws:transit-gateway": svc("aws-networking", "transit-gateway"),
  "aws:internet-gateway": svc("aws-networking", "internet-gateway"),
  "aws:nat-gateway": svc("aws-networking", "nat-gateway"),
  "aws:elastic-ip": svc("aws-networking", "elastic-ip"),
  "generic:vpn": svc("aws-networking", "client-vpn"),
  "aws:waf": svc("aws-security", "waf"),
  "aws:shield": svc("aws-security", "shield"),
  "aws:cognito": svc("aws-security", "cognito"),
  "aws:iam": svc("aws-security", "iam"),
  "aws:kms": svc("aws-security", "kms"),
  "aws:secrets-manager": svc("aws-security", "secrets-manager"),
  "aws:cloudwatch": svc("aws-management", "cloudwatch"),
  "aws:cloudtrail": svc("aws-management", "cloudtrail"),
  "aws:xray": svc("aws-developer", "xray"),
  "aws:iot": svc("aws-iot", "iot-core"),
  "aws:ml": svc("aws-ml", "bedrock"),
  "generic:workflow": svc("aws-integration", "step-functions"),
  "generic:registry": svc("aws-containers", "ecr"),
  "generic:cicd": svc("aws-developer", "codepipeline"),
};

/** Hints whose catalog service is AWS-only: drawn as AWS only on AWS pages (see `serviceFor`). */
const AWS_FALLBACKS = new Set([
  "generic:workflow",
  "generic:registry",
  "generic:cicd",
  "generic:vpn",
]);

/** The catalog service a sidecar service draws as, if any. */
export function serviceFor(
  hint: string | undefined,
  platformIsAws: boolean,
): CatalogService | undefined {
  if (!hint) return undefined;
  if (AWS_FALLBACKS.has(hint) && !platformIsAws) return undefined;
  return VISUAL_SERVICES[hint];
}

/** The panel kind a boundary draws as (Structura `PanelKind` values); undefined is a plain panel. */
export function boundaryPanelKind(hint: string | undefined, label: string): string | undefined {
  const text = label.toLowerCase();
  switch (hint) {
    case "generic:vpc":
      return "vpc";
    case "generic:subnet":
      return /\b(public|publica|pública|dmz)\b/.test(text) ? "public-subnet" : "private-subnet";
    case "generic:az":
      return "availability-zone";
    case "generic:auto-scaling-group":
      return "auto-scaling-group";
    case "generic:cluster":
      return /\beks\b|kubernetes|k8s/.test(text)
        ? "eks-cluster"
        : /\becs\b/.test(text)
          ? "ecs-cluster"
          : undefined;
    default:
      return undefined;
  }
}

export interface DrawnThrough {
  /** The manifest edge, as `Kind/a -type-> Kind/b`. */
  edge: string;
  /** Labels of the elements it is drawn through. */
  via: string[];
}

export interface VisualLayerResult {
  graph: ImporterGraph;
  /** Manifest edges drawn as the chain they were collapsed from instead of a direct connection. */
  drawnThrough: DrawnThrough[];
}

/** Decoration with less than this many characters (step badges, bare arrows) is not drawn. */
const MIN_TEXT = 2;

const isAwsPage = (visual: VisualFile) =>
  Object.values(visual.elements).some(
    (e) => e.hint?.startsWith("aws:") || /mxgraph\.aws/.test(e.style),
  );

/**
 * `graph` (the technical view's importer graph) with the visual layer drawn on it: boundaries as
 * panels holding what was drawn inside them — manifest panels included —, sidecar services as
 * catalog components (or unknown ones), decoration as text, and the drawn edges outside the
 * manifests. A manifest edge collapsed from a chain is drawn as that chain.
 */
export function withVisualLayer(graph: ImporterGraph, visual: VisualFile): VisualLayerResult {
  const manifest = new Map(graph.components.map((c) => [c.key, c]));
  const aws = isAwsPage(visual);

  const drawn = new Map<string, ImporterGraphComponent>();
  for (const [key, element] of Object.entries(visual.elements)) {
    const label = element.label.replace(/\s*\n\s*/g, " ").trim();
    if (element.role === "decoration") {
      if (label.length < MIN_TEXT) continue;
      drawn.set(key, {
        key,
        name: label,
        type: "text",
        description: "",
        x: 0,
        y: 0,
        width: element.box.width,
      });
      continue;
    }
    if (element.role === "boundary") {
      const panelKind = boundaryPanelKind(element.hint, label);
      drawn.set(key, {
        key,
        name: label,
        type: "panel",
        description: element.hint ?? "",
        ...(panelKind ? { panelKind } : {}),
        x: 0,
        y: 0,
        width: element.box.width,
        height: element.box.height,
      });
      continue;
    }
    const service = serviceFor(element.hint, aws);
    const name = element.label.split("\n")[0] ?? label;
    drawn.set(key, {
      key,
      name: name || label,
      type: service?.type ?? "unknown",
      description: label,
      ...(service ? { cloudServiceId: service.catalogServiceId } : {}),
      x: 0,
      y: 0,
    });
  }

  // Page-absolute boxes, whichever sidecar placed the element.
  const absCache = new Map<string, { x: number; y: number }>();
  const absolute = (key: string, depth = 0): { x: number; y: number } => {
    const cached = absCache.get(key);
    if (cached) return cached;
    let at = { x: 0, y: 0 };
    if (depth < 64) {
      const element = visual.elements[key];
      const component = manifest.get(key);
      if (element) {
        const p = element.parent ? absolute(element.parent, depth + 1) : { x: 0, y: 0 };
        at = { x: p.x + element.box.x, y: p.y + element.box.y };
      } else if (component) {
        const p = component.parentKey ? absolute(component.parentKey, depth + 1) : { x: 0, y: 0 };
        at = { x: p.x + component.x, y: p.y + component.y };
      }
    }
    absCache.set(key, at);
    return at;
  };

  // Containers: manifest panels and drawn boundaries.
  const isContainer = (key: string) =>
    drawn.get(key)?.type === "panel" ||
    (manifest.get(key)?.width !== undefined && manifest.get(key)?.height !== undefined);
  const memberOf = new Map<string, string>();
  for (const [key, element] of Object.entries(visual.elements)) {
    if (element.role !== "boundary" || !drawn.has(key)) continue;
    for (const member of element.members ?? []) memberOf.set(member, key);
  }
  const visualParent = (key: string): string | null => {
    let p = visual.elements[key]?.parent ?? null;
    for (let i = 0; p && i < 64; i++) {
      if ((drawn.has(p) || manifest.has(p)) && isContainer(p)) return p;
      p = visual.elements[p]?.parent ?? null;
    }
    return null;
  };

  const place = (c: ImporterGraphComponent, parentKey: string | null): ImporterGraphComponent => {
    const at = absolute(c.key);
    const p = parentKey ? absolute(parentKey) : { x: 0, y: 0 };
    const placed: ImporterGraphComponent = {
      ...c,
      x: Math.round(at.x - p.x),
      y: Math.round(at.y - p.y),
    };
    if (parentKey) placed.parentKey = parentKey;
    else delete placed.parentKey;
    return placed;
  };

  const components: ImporterGraphComponent[] = [];
  for (const c of graph.components) {
    const boundary = memberOf.get(c.key);
    components.push(boundary ? place(c, boundary) : c);
  }
  for (const [key, c] of drawn) components.push(place(c, memberOf.get(key) ?? visualParent(key)));

  // Parents before children, so a host that resolves parents as it inserts finds them.
  const byKey = new Map(components.map((c) => [c.key, c]));
  const depth = (c: ImporterGraphComponent): number => {
    let d = 0;
    for (let p = c.parentKey; p !== undefined && d < 64; p = byKey.get(p)?.parentKey) d++;
    return d;
  };
  components.sort((a, b) => depth(a) - depth(b));

  // Edges outside the manifests; a collapsed chain replaces its manifest edge.
  const ends = new Set(components.map((c) => c.key));
  const connections: ImporterGraphConnection[] = [...graph.connections];
  const chains = new Map<string, string[]>();
  for (const edge of visual.edges) {
    if (!edge.from || !edge.to || !ends.has(edge.from) || !ends.has(edge.to)) continue;
    connections.push({ source: edge.from, target: edge.to, label: edge.label });
    if (edge.collapsedInto) {
      const via = chains.get(edge.collapsedInto) ?? [];
      for (const end of [edge.from, edge.to]) {
        const element = visual.elements[end];
        if (element && !via.includes(end)) via.push(end);
      }
      chains.set(edge.collapsedInto, via);
    }
  }
  const drawnThrough: DrawnThrough[] = [];
  for (const [collapsed, via] of chains) {
    const m = /^(.+?) -(\w+)-> (.+)$/.exec(collapsed);
    if (!m) continue;
    const [, source, type, target] = m;
    const i = connections.findIndex(
      (c) => c.source === source && c.target === target && c.label === type,
    );
    if (i < 0) continue;
    connections.splice(i, 1);
    drawnThrough.push({ edge: collapsed, via: via.map((key) => drawn.get(key)?.name ?? key) });
  }

  return { graph: { components, connections }, drawnThrough };
}
