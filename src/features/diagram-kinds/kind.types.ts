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
