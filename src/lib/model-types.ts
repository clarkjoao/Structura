import type { AwsCategoryId } from "./aws-catalog";

export type ComponentType =
  | "person"
  | "system"
  | "container"
  | "component"
  | AwsCategoryId;

export interface Component {
  id: string;
  name: string;
  type: ComponentType;
  description: string;
  technology?: string;
  parentId: string | null;
  tags?: string[];
  awsService?: string;
  serviceId?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  zIndex?: number;
}

export interface ServiceDefinition {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  technology: string[];
  owner?: string;
  tags?: string[];
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  technology?: string;
  description?: string;
}

export interface ModelDraft {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  serviceRegistry: Record<string, ServiceDefinition>;
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
