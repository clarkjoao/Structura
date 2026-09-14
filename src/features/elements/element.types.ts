import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import type { NodeTypes } from "@xyflow/react";
import type { Component, ComponentPatch, ComponentType } from "@/features/diagram";
import type { NodeBuildContext, NodeHandleSpec } from "@/features/canvas/nodes/node-types";
import type { ExportNode, ExportNodeKind } from "@/lib/export-core";

/**
 * The id of a registered element — the same string that lives in
 * `Component.type`. Kept as `ComponentType` while the union is still closed;
 * the registry is what will let it open (see `plano-migracao-elementos.md`, F9).
 */
export type ElementTypeId = ComponentType;

/**
 * The ids that have actually moved onto the registry.
 *
 * A type-level mirror of what `bootstrap.ts` registers, and the reason the
 * legacy chains can drop a migrated branch without losing their
 * `const _exhaustive: never` check: narrowing on `isRegisteredElementType`
 * removes the id from the union the chain still has to cover. One literal is
 * added per migration slice, and `single-owner.invariant.test.ts` holds this
 * list and the runtime registry to each other.
 */
export type RegisteredElementTypeId = "json-viewer" | "note" | "db-table";

/**
 * Which vocabulary an element belongs to. Only `"structural"` is used while F1
 * is the whole of the registry; cloud families arrive with F4.
 */
export type ElementFamilyId = "structural" | "c4" | "aws" | "gcp" | "azure";

/**
 * How the node is drawn, as a role rather than a shape. This is the narrow
 * union that keeps exhaustiveness once `ComponentType` opens up — see
 * `proposta-arquitetura-elementos.md` §1.6.
 */
export type ElementRenderRole = "card" | "container" | "custom-shape";

/** Palette accent: a CSS custom-property name, or the neutral swatch. */
export type AccentToken = { kind: "neutral" } | { kind: "token"; cssVar: string };

/** How the palette draws this element. */
export type PaletteIcon =
  | { kind: "lucide"; icon: LucideIcon }
  /** Resolved through the owning family's `IconResolver` (F4+). */
  | { kind: "family"; iconName: string };

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
  createComponent: (base: ElementComponentBase) => Component;

  /**
   * Size a new node is created at. Unlike `NodeTypeDescriptor.defaultSize`,
   * which the creation path ignored, this one governs
   * (`proposta-arquitetura-elementos.md`, decision 3).
   */
  defaultSize: { width: number; height: number };

  /** i18n key for the default name of a new instance; blank name when absent. */
  defaultNameKey?: string;

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
   * Whether the painted size is computed from the component's own content.
   *
   * `model.defaultSize` is the size at creation; for most elements that is also
   * what they keep painting at. A `db-table` is the counter-example: its height
   * is its column count, so the two agree only while it is empty. Stating which
   * it is here is what lets the single-owner test check the agreement for
   * fixed-size elements — the drift it catches is exactly the one that left
   * db-table's unused `defaultSize` at 180 while the node painted at 76.
   */
  derivesSizeFromContent: boolean;

  buildData: (comp: Component, ctx: NodeBuildContext) => Record<string, unknown>;
  buildStyle?: (comp: Component, ctx: NodeBuildContext) => CSSProperties | undefined;

  /** React Flow behaviour overrides, same meaning as in `NodeTypeDescriptor`. */
  dragHandle?: string;
  draggable?: boolean;
  selectable?: boolean;
  focusable?: boolean;
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
}

/** How the element is edited when selected. */
export interface ElementInspectorSlice {
  /** Absent means the generic `ComponentPanel`. */
  panel?: ElementInspectorPanel;
  sections?: readonly string[];
}

/**
 * How the element leaves Structura. Not optional: an element with no mapping
 * cannot be registered (decision 6).
 */
export interface ElementExportSlice {
  drawio: {
    kind: ExportNodeKind;
    toExportNode: (comp: Component, base: ExportGeometry) => ExportNode;
    minSize?: { width: number; height: number };
  };
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
  palette: ElementPaletteSlice;
  inspector: ElementInspectorSlice;
  export: ElementExportSlice;
}
