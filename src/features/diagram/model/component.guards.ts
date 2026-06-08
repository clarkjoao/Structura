import { isAwsType } from "@/lib/catalogs/aws";
import { isGcpType } from "@/features/cloud/providers/gcp/gcp.catalog";
import { isAzureType } from "@/features/cloud/providers/azure/azure.catalog";
import { cloudRegistry } from "@/features/cloud";
import type {
  Component,
  C4Component,
  PanelComponent,
  NoteComponent,
  AwsComponent,
  GcpComponent,
  AzureComponent,
  ApiGroupComponent,
  EndpointComponent,
  UnknownComponent,
  SvgComponent,
  DbTableComponent,
  JsonViewerComponent,
  FlowNodeComponent,
} from "./component.types";
import {
  isPanelType,
  isNoteType,
  isC4Type,
  isApiGroupType,
  isEndpointType,
  isUnknownType,
  isSvgComponentType,
  isDbTableType,
  isJsonViewerType,
  isFlowNodeType,
} from "./component-type-constants";

export const isPanelComponent = (c: Component): c is PanelComponent => isPanelType(c.type);

export const isNoteComponent = (c: Component): c is NoteComponent => isNoteType(c.type);

export const isC4Component = (c: Component): c is C4Component => isC4Type(c.type);

export const isAwsComponent = (c: Component): c is AwsComponent => isAwsType(c.type);

export const isGcpComponent = (c: Component): c is GcpComponent => isGcpType(c.type);

export const isAzureComponent = (c: Component): c is AzureComponent => isAzureType(c.type);

export const isCloudComponent = (
  c: Component,
): c is AwsComponent | GcpComponent | AzureComponent => cloudRegistry.isCloudType(c.type);

export const isApiGroupComponent = (c: Component): c is ApiGroupComponent => isApiGroupType(c.type);

export const isEndpointComponent = (c: Component): c is EndpointComponent => isEndpointType(c.type);

export const isUnknownComponent = (c: Component): c is UnknownComponent => isUnknownType(c.type);

export const isSvgComponent = (c: Component): c is SvgComponent => isSvgComponentType(c.type);
export const isDbTableComponent = (c: Component): c is DbTableComponent => isDbTableType(c.type);

export const isJsonViewerComponent = (c: Component): c is JsonViewerComponent =>
  isJsonViewerType(c.type);

export const isFlowNodeComponent = (c: Component): c is FlowNodeComponent =>
  isFlowNodeType(c.type);
