import type { AwsCategoryId } from "./aws-catalog";

export type ComponentType =
  | "person"
  | "system"
  | "container"
  | "component"
  | AwsCategoryId;

export type Level = "context" | "container" | "component";

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
  parentId: string | null;
  tags?: string[];
  awsService?: string; // maybe turn it more agnostic
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  technology?: string;
  description?: string;
}

export interface ViewNodeLayout {
  elementId: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface BluePrintView {
  id: string;
  name: string;
  level: Level;
  rootElementId: string | null; // which element we're "inside" (null = top-level context)
  nodeLayouts: ViewNodeLayout[];
  viewport: { x: number; y: number; zoom: number };
}

/** The complete working draft — everything that gets snapshotted on commit */
export interface ModelDraft {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  bluePrintViews: Record<string, BluePrintView>;
  activeBluePrintViewId: string;
}

export interface BluePrintVersion {
  id: string;
  version: string;
  parentId: string | null;
  timestamp: string;
  author: string;
  message: string;
  snapshot: ModelDraft;
}

let _counter = 0;
export const generateId = (prefix: string = "el") =>
  `${prefix}-${Date.now().toString(36)}-${(++_counter).toString(36)}`;
