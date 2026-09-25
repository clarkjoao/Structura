import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import type { NodeTypes } from "@xyflow/react";
import type {
  Component,
  ComponentPatch,
  ComponentType,
} from "@/features/diagram/model/component.types";
import type { K8sCategoryId } from "@/features/elements/families/k8s/k8s.catalog";
import type { OssCategoryId } from "@/features/elements/families/oss/oss.catalog";
import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import type { NodeHandleSpec } from "@/features/canvas/nodes/node-types/handle-spec";
import type { PanelKind } from "@/features/diagram/enums";
import type { NodeLayout } from "@/features/diagram/model/layout.types";
import type {
  FlowNodeShape,
  NodeStrokeMode,
  VsmRole,
} from "@/features/diagram/model/component.types";
import type { ExportNode } from "@/lib/export-core";

/**
 * The id of a registered element — the same string that lives in
 * `Component.type`. Kept as `ComponentType` while the union is still closed;
 * the registry is what will let it open — see ADR-0010.
 */
export type ElementTypeId = ComponentType;

/**
 * The ids that have a type-level mirror for exhaustiveness (`Extract` in
 * `isRegisteredElementComponent`).
 *
 * Catalog families with typed `*Component` interfaces (aws/gcp/azure/k8s/oss)
 * stay listed so export / create exhaustiveness keeps working. A *future*
 * family's category ids are validated only at runtime by the registry — they
 * are not added here. See `OpenCatalogCategoryId` and
 * `cloud-family-contract.test.ts`.
 */
export type RegisteredElementTypeId =
  | "person"
  | "system"
  | "container"
  | "component"
  | "json-viewer"
  | "note"
  | "db-table"
  | "api-group"
  | "endpoint"
  | "panel"
  | "process-node"
  | "external-element"
  | "vsm-external"
  | "deploy-shard-router"
  | "deploy-shard"
  | "deploy-sharded-store"
  | "flow-divider"
  | "vsm-timeline"
  | "vsm-kaizen"
  | "vsm-push"
  | "vsm-supermarket"
  | "vsm-inventory"
  | "vsm-process"
  | "svg"
  | "unknown"
  | "gcp-compute"
  | "gcp-storage"
  | "gcp-database"
  | "gcp-networking"
  | "gcp-security"
  | "gcp-analytics"
  | "gcp-ai"
  | "gcp-devtools"
  | "gcp-integration"
  | "gcp-management"
  | "gcp-media"
  | "gcp-general"
  | "azure-compute"
  | "azure-storage"
  | "azure-database"
  | "azure-networking"
  | "azure-security"
  | "azure-analytics"
  | "azure-ai"
  | "azure-integration"
  | "azure-devtools"
  | "azure-iot"
  | "azure-management"
  | "azure-media"
  | "azure-general"
  | "aws-compute"
  | "aws-storage"
  | "aws-database"
  | "aws-networking"
  | "aws-security"
  | "aws-analytics"
  | "aws-ml"
  | "aws-integration"
  | "aws-management"
  | "aws-developer"
  | "aws-containers"
  | "aws-media"
  | "aws-migration"
  | "aws-iot"
  | "aws-end-user"
  | "aws-general"
  | K8sCategoryId
  | OssCategoryId;

/**
 * Which vocabulary an element belongs to.
 *
 * `"structural"` and `"c4"` are fixed. Catalog-shaped families use an open
 * `CloudFamilyId` string (aws, gcp, azure, …) registered via
 * `registerCloudFamily` — not a closed union that must grow per family.
 */
export type ElementFamilyId = "structural" | "c4" | (string & {});

/**
 * How the node is drawn, as a role rather than a shape. This is the narrow
 * union that keeps exhaustiveness once `ComponentType` opens up.
 */
export type ElementRenderRole = "card" | "container" | "custom-shape";

/** Palette accent: a CSS custom-property name, or the neutral swatch. */
export type AccentToken = { kind: "neutral" } | { kind: "token"; cssVar: string };

/** How the palette draws this element. */
export type PaletteIcon =
  | { kind: "lucide"; icon: LucideIcon }
  /** Resolved through the owning family's `IconResolver` (F4+). */
  | { kind: "family"; iconName: string };

/**
 * The rest of the diagram, for an element whose export depends on it: a
 * typed container draws its children's count and distribution (a sharded
 * store's key bar). Most mappings ignore it.
 */
export interface ExportContext {
  components: Record<string, Component>;
  layouts: Record<string, NodeLayout>;
}

/** Geometry the export adapter has already resolved for a node. */
export interface ExportGeometry {
  id: string;
  parentId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Props every inspector panel receives.
 *
 * `component` is the wide `Component` union on purpose: the registry cannot
 * know which variant a descriptor handles, so each element narrows it with its
 * own guard inside a small adapter. That keeps the contract free of casts,
 * which the repo forbids.
 */
export interface ElementInspectorProps {
  component: Component;
  onClose: () => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
  removeComponent: (id: string) => void;
  focusTitleTrigger?: number;
}

export type ElementInspectorPanel = (props: ElementInspectorProps) => React.ReactNode;

/**
 * What the caller asked for beyond a name and a parent.
 *
 * `addComponent` has carried these as trailing positional arguments since
 * before the registry existed; a descriptor that varies by them — a panel is
 * the first — needs them by name.
 */
export interface ElementCreateOptions {
  panelKind?: PanelKind;
  flowShape?: FlowNodeShape;
  serviceId?: string;
  /** Which end of a value stream an outside source is (`vsm-external`). */
  vsmRole?: VsmRole;
  /**
   * Drawn dashed from the start: the line of visibility, or a lane's outline
   * (the physical-evidence lane).
   */
  stroke?: NodeStrokeMode;
  /** A swimlane's accent from a preset (a flow-preset theme token). */
  laneAccent?: string;
  /** i18n key of a preset swimlane's label. */
  laneLabelKey?: string;
}

export interface ElementSize {
  width: number;
  /** Omitted means the node measures itself; see `ElementModelSlice.defaultSize`. */
  height?: number;
}

/** The fields the store owns on every component, whatever its type. */
export interface ElementComponentBase {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
}

/** What the element is, as data: fields, size and creation defaults. */
export interface ElementModelSlice {
  /**
   * Builds a new component of this type.
   *
   * Takes the base the store owns — a descriptor never invents an id — and
   * returns a fully typed `Component`. It returns the component rather than a
   * bag of extra fields precisely so the store needs no cast to assemble one:
   * `Record<string, unknown>` spread onto a base cannot be a `Component`
   * without one, and casts are not allowed here.
   */
  createComponent: (base: ElementComponentBase, options: ElementCreateOptions) => Component;

  /**
   * Size a new node is created at. Unlike `NodeTypeDescriptor.defaultSize`,
   * which the creation path ignored, this one governs.
   *
   * `height` is optional because leaving it out is meaningful: the node
   * measures itself, and writing a height would pin it to a number the
   * content never agreed to. A standalone `endpoint` is the case — its
   * style sets `minHeight` and lets the content decide the rest.
   *
   * A function when the size depends on what was asked for: a swimlane is
   * created at lane proportions and an ordinary panel is not, and both are
   * the same `panel` type.
   */
  defaultSize: ElementSize | ((options: ElementCreateOptions) => ElementSize);

  /**
   * Stacking order written into the node's layout at creation.
   *
   * Distinct from `canvas.zIndex`, which is the render-time order: a frame
   * like `api-group` is created behind its children and has to *stay* there
   * in the stored layout, not only while it is being painted.
   */
  defaultZIndex?: number;

  /** Fields the element cannot do without; surfaced to the LLM catalog too. */
  requiredFields?: readonly string[];

  /** Fields that may be copied into a patch (presets, templates, imports). */
  patchableKeys: readonly string[];
}

/** How the element renders on the React Flow canvas. */
export interface ElementCanvasSlice {
  rfType: string;
  component: NodeTypes[string];
  handles: NodeHandleSpec;
  role: ElementRenderRole;
  zIndex: number | ((comp: Component) => number);
  connectable: boolean;
  canHaveParent: boolean;
  canBeParent: boolean;

  /**
   * Whether an edge may leave this element. Mirrors
   * `connection-rules.ts#canBeConnectionSource`, which stays the domain-side
   * reader while types are still split between the two registries.
   */
  canBeConnectionSource: boolean;

  /**
   * Whether the painted size is computed rather than being the stored one.
   *
   * `model.defaultSize` is the size at creation; for most elements that is also
   * what they keep painting at. Three kinds of element break that, and all
   * three say the same thing to a reader of the stored layout:
   *
   * - `db-table` computes its height from its own column count;
   * - `api-group` computes its height from how many endpoints it holds;
   * - `endpoint` takes its size from where it sits — one row inside a group,
   *   or its own content when standalone.
   *
   * Only the first of those is "content", which is why this is no longer
   * called `derivesSizeFromContent`. What it states is that the stored size is
   * not authoritative — and that is what the single-owner test checks the
   * other elements against: a fixed-size element must still paint at the size
   * it was created at. That is the drift that left db-table's unread
   * `defaultSize` at 180 while the node painted at 76.
   */
  derivesSize: boolean;

  buildData: (comp: Component, ctx: NodeBuildContext) => Record<string, unknown>;
  buildStyle?: (comp: Component, ctx: NodeBuildContext) => CSSProperties | undefined;

  /**
   * The child types a typed container takes, like an api-group takes
   * endpoints. Absent means the container takes anything, as a panel does.
   * Enforced by the store on every path that can nest a node (`canContain`),
   * so a paste or a generated graph cannot do what a drop is refused.
   */
  acceptsChildren?: readonly string[];

  /**
   * The container has a compact mode, switched by the component's optional
   * `collapsed` flag (absent = expanded, never written as `false`). Compact,
   * its children are hidden and the edges that reach them are drawn to the
   * container instead — the data stays as it is (`isCompactContainer`).
   */
  collapsible?: boolean;

  /** React Flow behaviour overrides, same meaning as in `NodeTypeDescriptor`. */
  dragHandle?: string;
  draggable?: boolean;
  selectable?: boolean;
  focusable?: boolean;
}

/**
 * One of several ways the same element is offered.
 *
 * `panel` is why this exists too: the palette shows a VPC, an EKS cluster, a
 * swimlane and six more, and every one of them creates a `panel` — they differ
 * only by the `panelKind` they are created with. One registry entry per type
 * would have collapsed nine palette entries into one.
 */
export interface ElementPaletteVariant {
  /** Stable key; also what usage tracking records. */
  id: string;
  labelKey: string;
  icon: PaletteIcon;
  /** Passed to `createComponent` when this entry is picked. */
  createOptions: ElementCreateOptions;
  searchKeys?: readonly string[];
  /**
   * An icon from the AWS pack, rendered instead of `icon` when present.
   *
   * Carried verbatim from the panel-kind catalog so the palette looks the same
   * as before; families get their own icon resolution in F4 and this goes with
   * it.
   */
  awsIconName?: string;
}

/** How the element is offered to the user. */
export interface ElementPaletteSlice {
  categoryId: string;
  icon: PaletteIcon;
  accent: AccentToken;
  /** Extra words the search matches on, beyond the label. */
  searchKeys: readonly string[];
  /** Lower sorts earlier in "spotlight" strips; absent means not featured. */
  spotlight?: number;
  /** One palette entry each, instead of a single entry for the element. */
  variants?: readonly ElementPaletteVariant[];
  /**
   * Held back from everything that *offers* elements — the picker, quick
   * insert, the LLM catalog and element search — while the element stays
   * registered: saved diagrams keep rendering, exporting and round-tripping
   * it. For a vocabulary that is built but not released yet.
   */
  hidden?: boolean;
}

/** How the element is edited when selected. */
export interface ElementInspectorSlice {
  /** Absent means the generic `ComponentPanel`. */
  panel?: ElementInspectorPanel;
}

/**
 * How the element leaves Structura. Not optional: an element with no mapping
 * cannot be registered (decision 6).
 */
export interface ElementExportSlice {
  drawio: {
    /**
     * The whole mapping. There is no separate `kind` field beside it: one
     * element can map to more than one export kind — a `panel` emits the
     * swimlane cell when it is a lane — so naming a single kind here would
     * have been a value no reader could trust, and nothing read it.
     */
    toExportNode: (comp: Component, base: ExportGeometry, context?: ExportContext) => ExportNode;
  };
}

/**
 * An alternative rendering of the same domain type, chosen per component.
 *
 * `panel` is why this exists. A swimlane is not a `ComponentType` — it is a
 * `panelKind` on a panel — so the two cannot be two registry entries without
 * breaking the rule that a type has exactly one owner. Before this, the canvas
 * resolver carried a hardcoded `if (panelKind === Swimlane)` branch naming one
 * descriptor; declaring the variant here is the same statement, made by the
 * element that owns it instead of by the resolver.
 */
export interface ElementCanvasVariant {
  /** Chosen for components this matches; evaluated before the base slice. */
  matches: (comp: Component) => boolean;
  canvas: ElementCanvasSlice;
}

/**
 * The colour-in-parts skin the flowchart shapes introduced — an accent
 * (`customColor`), a fill and a stroke — for every element that wears it (the
 * flow and VSM families). Its presence is what gives an element the flow
 * accent presets in the toolbar and the Appearance section in the inspector.
 */
export interface ElementSkin {
  /**
   * The accent a node shows when none is stored. Resolved at render and never
   * written: picking it in a control clears the stored accent instead.
   */
  defaultAccent: string;
}

export interface ElementDescriptor {
  id: ElementTypeId;
  family: ElementFamilyId;
  /** i18n key for the element's display name. Must exist in every locale. */
  labelKey: string;
  /** i18n key for the one-line description shown in the palette and to the LLM. */
  descriptionKey: string;

  model: ElementModelSlice;
  canvas: ElementCanvasSlice;
  /** Alternative renderings, tried in order before `canvas`. */
  variants?: readonly ElementCanvasVariant[];
  palette: ElementPaletteSlice;
  inspector: ElementInspectorSlice;
  export: ElementExportSlice;
  /** Present when the element wears the flow skin; see `ElementSkin`. */
  skin?: ElementSkin;
}
