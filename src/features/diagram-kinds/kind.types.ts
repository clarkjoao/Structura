import type { Component, FlowNodeShape } from "@/features/diagram/model/component.types";
import type {
  Diagram,
  DiagramDirection,
  DiagramModel,
} from "@/features/diagram/model/diagram.types";
import type { DiagramLayoutSettings } from "@/features/diagram/model/layout-settings";

/**
 * The diagram-kind contract (ADR-0014).
 *
 * A kind guides the construction of one kind of diagram over ordinary content.
 * A contribution is plain data plus pure functions, validated at registration,
 * and it reads the world only through the context it is handed — never the
 * store. Built-in kinds register through this same contract, which is the test
 * that it is enough for a plugin kind later.
 */

/** Display text: an i18n key for a built-in kind, or the plugin's own translations. */
export type KindText = { key: string } | { text: string | Partial<Record<"en" | "pt-BR", string>> };

/** An element type (and optional variant) a kind's palette offers. */
export interface KindElementRef {
  /** Any registered element type id, built-in or a plugin's (`<pluginId>/<name>`). */
  type: string;
  /** For `process-node`: the flowchart shape. */
  flowShape?: FlowNodeShape;
  /** Offered as its own button on the canvas toolbar; the rest sit under "More". */
  primary?: boolean;
  /** The name surfaces show for it, instead of the catalog entry's. */
  label?: KindText;
}

/** What the canvas lets the author do while the diagram is in its kind's mode. */
export interface KindInteraction {
  nodesDraggable: boolean;
  resizable: boolean;
  /** Whether the Arrange menu offers the Manual/Automatic mode choice. */
  arrangeModeChoice: boolean;
  /** Whether the flows panel offers recording a new flow. */
  recordFlows: boolean;
  /**
   * Whether an element can be referenced (a shared reference, an edge routed through one).
   * A kind whose rules read every element where it stands turns them off. Absent means allowed.
   */
  references?: boolean;
}

import type { KindEdit } from "@/features/diagram/model/kind-edit.types";

/** Something that stops a diagram from conforming to its kind. */
export interface KindIssue {
  /** Stable code, e.g. `outside-lane`. */
  code: string;
  /** The element concerned; null for a diagram-wide issue. */
  elementId: string | null;
  message: KindText;
  /** Interpolation values for `message`. */
  values?: Record<string, string | number>;
}

/** A quiet marker on the canvas: never a dialog, never blocking. */
export interface KindMarker {
  code: string;
  elementId: string;
  /** Whether it sits on a connection rather than a node. */
  onConnection: boolean;
  message: KindText;
  values?: Record<string, string | number>;
  /** A small badge the host draws on the node (spec guided-journey-experience). */
  badge?: KindBadge;
  /** Whether the element is outlined as checked. Absent means yes; a badge-only marker says no. */
  marks?: boolean;
}

/**
 * What a kind draws over the canvas (spec guided-journey-phases): a header band
 * along the reading axis with labelled segments, separators crossing the
 * lanes, and a curve. Flow coordinates; drawn by the host, never an element.
 */
export interface KindOverlay {
  /** The reading axis: "x" left to right, "y" top to bottom. */
  axis: "x" | "y";
  /** The band's near edge across the axis (its top on "x"), and its depth. */
  at: number;
  depth: number;
  segments: Array<{ id: string; label: string; from: number; to: number; selects?: string }>;
  /** Lines across the lanes at a position along the axis. */
  separators: Array<{ along: number; from: number; to: number }>;
  /** Points along the axis, `value` 0 (low) to 1 (high), drawn in the band. */
  curve: Array<{ id: string; along: number; value: number; tone: KindBadge["tone"] }>;
}

/** A badge on a node: short text and a tone. */
export interface KindBadge {
  text: string;
  tone: "danger" | "warning" | "success" | "neutral";
}

/** What a kind sees: read access and services, never the store. */
export interface KindContext {
  t: (key: string, values?: Record<string, string | number>) => string;
  isElementRegistered: (type: string) => boolean;
  direction: DiagramDirection;
  layoutSettings: DiagramLayoutSettings | undefined;
  /** Mints ids for flows and flow steps the kind derives. */
  newId: (prefix: string) => string;
}

/** Positions a kind's arrangement asks for, in the coordinates `applyAutoLayout` takes. */
export interface KindArrangement {
  layouts: Array<{ elementId: string; x: number; y: number; width?: number; height?: number }>;
}

/** The measured size of a node, when the canvas has painted it. */
export type MeasuredSizes = Readonly<Record<string, { width: number; height: number }>>;

/** What the host hands a kind's arrangement: painted sizes and the density's gaps. */
export interface KindLayoutServices {
  measured: MeasuredSizes;
  /** Gaps from the diagram's density: between layers, between nodes in a layer. */
  gaps: { layer: number; node: number };
}

/** The selection a kind command runs against. */
export interface KindCommandContext extends KindContext {
  diagram: DiagramModel;
  selectedIds: readonly string[];
}

/** What a command asks the host to do: apply an edit, then select and maybe edit a label. */
export interface KindCommandOutcome {
  edit: KindEdit;
  /** A node key of the edit, or an existing id. */
  select?: string;
  /** An existing connection to select instead of a node. */
  selectConnection?: string;
  /** Open label editing on what the outcome selects. */
  editLabel?: boolean;
}

/** An action a kind offers on one element: in its context menu and in the inspector. */
export interface KindElementAction {
  id: string;
  label: KindText;
  values?: Record<string, string | number>;
  /** Actions sharing a group are shown together (e.g. "lane", "moveTo"). */
  group: string;
  danger?: boolean;
  /**
   * How the canvas draws it as an icon beside the element: `before` / `after` point across the
   * reading axis (up/down, or left/right on a top-to-bottom diagram). Absent: shown as text.
   */
  glyph?: KindActionGlyph;
  run: () => KindCommandOutcome | { refused: KindText };
}

export type KindActionGlyph = "add" | "before" | "after" | "remove";

/** A text the kind could not read, by 1-based line. */
export interface KindTextError {
  line: number;
  message: KindText;
  values?: Record<string, string | number>;
}

/** What a text adds: the edit to apply (one undo step), and a summary to show. */
export interface KindTextBuild extends KindCommandOutcome {
  summary: KindText;
  summaryValues?: Record<string, string | number>;
  /** Elements the text adds; the canvas only takes a paste as text when it adds two or more. */
  nodeCount: number;
}

/**
 * Writing a kind diagram as text (spec guided-journey-outline): the panel, a
 * canvas paste and the assistant all build through it; the host applies.
 */
export interface KindTextCapture {
  /** Pure: the edit `text` adds after the selection, or why it cannot. */
  build: (
    ctx: KindCommandContext,
    text: string,
  ) => KindTextBuild | { refused: KindText } | { errors: KindTextError[] };
  /** The diagram written back as text. */
  serialize: (diagram: DiagramModel, ctx: KindContext) => string;
  /** A short description of the syntax, for the panel and the assistant. */
  syntax: KindText;
  /** The formats the diagram can be copied as; the first is `serialize`'s. Absent: only that one. */
  formats?: readonly KindTextFormat[];
  placeholder?: KindText;
}

/** An inspector field a kind may hide in kind mode (spec guided-editing-surfaces). */
export type KindInspectorField = "technology" | "type" | "shape";

/** One option of a choice section; `run` applies it. */
export interface KindInspectorOption {
  id: string;
  label: KindText;
  /** Drawn with this element's icon. */
  element?: KindElementRef;
  selected: boolean;
  /** Creates something new (e.g. a new lane), drawn apart from the choices. */
  creates?: boolean;
  run: () => KindCommandOutcome | { refused: KindText };
}

/** One editable label of a labels section (e.g. a decision's exit). */
export interface KindInspectorLabel {
  id: string;
  /** The field's title, e.g. "To {{name}}" for an exit. */
  title: KindText;
  values?: Record<string, string | number>;
  placeholder?: KindText;
  label: string;
  commit: (label: string) => KindCommandOutcome | { refused: KindText };
}

/** A block of the kind's inspector tab, drawn by the host. */
export type KindInspectorSection =
  | { type: "choice"; id: string; label: KindText; options: KindInspectorOption[] }
  | {
      type: "labels";
      id: string;
      label: KindText;
      items: KindInspectorLabel[];
      /** Shown when there is nothing to label yet. */
      empty?: KindText;
    };

/**
 * The kind's own inspector tab (spec guided-editing-surfaces): data and pure
 * functions; the host draws the sections and applies what they return.
 */
export interface KindInspector {
  tab: KindText;
  /** Details fields hidden for the elements the tab applies to. */
  hiddenFields: readonly KindInspectorField[];
  /** The tab's sections for `elementId`; null when the tab does not apply to it (lanes, notes). */
  sections: (ctx: KindCommandContext, elementId: string) => KindInspectorSection[] | null;
}

/** A format a kind diagram can be written in (e.g. the outline, Mermaid). */
export interface KindTextFormat {
  id: string;
  label: KindText;
  serialize: (diagram: DiagramModel, ctx: KindContext) => string;
}

/** A command a kind contributes: a keyboard shortcut and/or a context-menu entry. */
export interface KindCommand {
  id: string;
  label: KindText;
  /** Shortcuts, e.g. `Tab`, `Shift+Tab`, `Alt+ArrowUp`, `Delete`. */
  keys?: readonly string[];
  /** Offered in the node context menu. */
  contextMenu?: boolean;
  enabled: (ctx: KindCommandContext) => boolean;
  /** An outcome, or a refusal the host shows as a notice. */
  run: (ctx: KindCommandContext) => KindCommandOutcome | { refused: KindText };
}

export interface DiagramKindDescriptor {
  /** Built-in: lowercase kebab-case. Contributed: `<pluginId>:<kind-id>`. */
  id: string;
  label: KindText;
  description?: KindText;
  /** The return action's label, e.g. "Back to guided". */
  returnLabel: KindText;
  /** Offered in the new-diagram dialog. */
  creatable: boolean;
  /** The palette while in kind mode. Empty means the whole palette. */
  elements: readonly KindElementRef[];
  interaction: KindInteraction;
  /** The content a new diagram of this kind starts with. */
  create?: (ctx: KindContext) => { edit: KindEdit; select?: string };
  /** Required: empty when the diagram conforms. */
  conforms: (diagram: DiagramModel, ctx: KindContext) => KindIssue[];
  /** Derived content (flows), applied after every structural edit. */
  derive?: (diagram: DiagramModel, ctx: KindContext) => KindEdit | null;
  /** The flows `derive` owns: shown as derived, not recorded over or removed while in kind mode. */
  derivedFlowIds?: (diagram: DiagramModel) => string[];
  /** The kind's arrangement, run after every structural edit. */
  arrange?: (
    diagram: DiagramModel,
    ctx: KindContext,
    layout: KindLayoutServices,
  ) => Promise<KindArrangement>;
  /**
   * What, beyond the structure (elements, parents, connections), the arrangement
   * reads — e.g. the order of lanes. A change to it re-arranges like a structural edit.
   */
  arrangeKey?: (diagram: DiagramModel) => string;
  /** Quiet markers; memoised by the host on snapshot identity. */
  checks?: (diagram: DiagramModel) => KindMarker[];
  commands?: readonly KindCommand[];
  /** Actions on one element (`targetId`), for its context menu and the inspector. */
  elementActions?: (ctx: KindCommandContext, targetId: string) => KindElementAction[];
  /**
   * Inserting a palette element while in kind mode: where it goes and what it connects to (e.g.
   * into the selected lane, after the selected step). Absent inserts as on a freehand diagram.
   */
  insert?: (
    ctx: KindCommandContext,
    element: KindElementRef,
  ) => KindCommandOutcome | { refused: KindText };
  /** Writing the diagram as text: offered while in kind mode. */
  textCapture?: KindTextCapture;
  /**
   * Markers worth walking (guided: pain points): the mode bar counts those with this code
   * and selects them in turn, in the order `checks` returns them. `label` takes `count`.
   */
  focusMarkers?: { code: string; label: KindText };
  /** What the kind draws over the canvas in kind mode (phases, a curve); null for nothing. */
  overlay?: (diagram: DiagramModel) => KindOverlay | null;
  /** The kind's inspector tab, offered while in kind mode. */
  inspector?: KindInspector;
  /** Whether a component may be dragged/inserted where it is, beyond `elements` (lanes, notes). */
  isAnnotation?: (component: Component) => boolean;
}

/** How the editor treats a diagram, resolved from its kind fields and the registry. */
export type KindPolicy =
  | { type: "freehand" }
  | { type: "kind"; descriptor: DiagramKindDescriptor }
  | { type: "kind-freehand"; descriptor: DiagramKindDescriptor }
  | { type: "kind-unavailable"; kindId: string };

/** A diagram as the policy resolver reads it. */
export type KindPolicyInput = Pick<Diagram, "kind" | "kindMode">;
