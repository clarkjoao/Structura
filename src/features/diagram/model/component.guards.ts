import { isAwsType } from "@/features/cloud/providers/aws/aws.catalog";
import { isGcpType } from "@/features/cloud/providers/gcp/gcp.catalog";
import { isAzureType } from "@/features/cloud/providers/azure/azure.catalog";
import { isK8sCategoryId } from "@/features/elements/families/k8s/k8s.catalog";
import { isOssCategoryId } from "@/features/elements/families/oss/oss.catalog";
import { cloudRegistry } from "@/features/cloud";
import type {
  Component,
  C4Component,
  PanelComponent,
  NoteComponent,
  AwsComponent,
  GcpComponent,
  AzureComponent,
  K8sComponent,
  OssComponent,
  ApiGroupComponent,
  EndpointComponent,
  UnknownComponent,
  SvgComponent,
  DbTableComponent,
  JsonViewerComponent,
  ProcessNodeComponent,
  ExternalElementComponent,
  SharedRefComponent,
  K8sContainerComponent,
  K8sIngressComponent,
  K8sServiceComponent,
  K8sWorkloadComponent,
  K8sNamespaceComponent,
  K8sClusterComponent,
  ShardRouterComponent,
  ShardComponent,
  ShardedStoreComponent,
  FlowDividerComponent,
  PluginTypedComponent,
} from "./component.types";
import {
  isPanelType,
  isNoteType,
  isPluginComponentType,
  isC4Type,
  isApiGroupType,
  isEndpointType,
  isUnknownType,
  isSvgComponentType,
  isDbTableType,
  isJsonViewerType,
  isProcessNodeType,
  isExternalElementType,
  isSharedRefType,
  isK8sContainerType,
  isK8sIngressType,
  isK8sServiceType,
  isK8sWorkloadType,
  isK8sNamespaceType,
  isK8sClusterType,
  isShardRouterType,
  isShardType,
  isShardedStoreType,
  isFlowDividerType,
} from "./component-type-constants";

export const isPanelComponent = (c: Component): c is PanelComponent => isPanelType(c.type);

export const isNoteComponent = (c: Component): c is NoteComponent => isNoteType(c.type);

export const isC4Component = (c: Component): c is C4Component => isC4Type(c.type);

export const isAwsComponent = (c: Component): c is AwsComponent => isAwsType(c.type);

export const isGcpComponent = (c: Component): c is GcpComponent => isGcpType(c.type);

export const isAzureComponent = (c: Component): c is AzureComponent => isAzureType(c.type);

export const isK8sComponent = (c: Component): c is K8sComponent => isK8sCategoryId(c.type);

export const isOssComponent = (c: Component): c is OssComponent => isOssCategoryId(c.type);

export type CloudProviderComponent =
  AwsComponent | GcpComponent | AzureComponent | K8sComponent | OssComponent;

export const isCloudComponent = (c: Component): c is CloudProviderComponent =>
  cloudRegistry.isCloudType(c.type);

export const isApiGroupComponent = (c: Component): c is ApiGroupComponent => isApiGroupType(c.type);

export const isEndpointComponent = (c: Component): c is EndpointComponent => isEndpointType(c.type);

export const isUnknownComponent = (c: Component): c is UnknownComponent => isUnknownType(c.type);

export const isSvgComponent = (c: Component): c is SvgComponent => isSvgComponentType(c.type);
export const isDbTableComponent = (c: Component): c is DbTableComponent => isDbTableType(c.type);

export const isJsonViewerComponent = (c: Component): c is JsonViewerComponent =>
  isJsonViewerType(c.type);

export const isProcessNodeComponent = (c: Component): c is ProcessNodeComponent =>
  isProcessNodeType(c.type);

/** @deprecated Use `isProcessNodeComponent` */
export const isFlowNodeComponent = (c: Component): c is ProcessNodeComponent =>
  isProcessNodeType(c.type);

export const isExternalElementComponent = (c: Component): c is ExternalElementComponent =>
  isExternalElementType(c.type);

export const isFlowDividerComponent = (c: Component): c is FlowDividerComponent =>
  isFlowDividerType(c.type);

export const isShardedStoreComponent = (c: Component): c is ShardedStoreComponent =>
  isShardedStoreType(c.type);

export const isShardComponent = (c: Component): c is ShardComponent => isShardType(c.type);

export const isShardRouterComponent = (c: Component): c is ShardRouterComponent =>
  isShardRouterType(c.type);

export const isK8sClusterComponent = (c: Component): c is K8sClusterComponent =>
  isK8sClusterType(c.type);

export const isK8sNamespaceComponent = (c: Component): c is K8sNamespaceComponent =>
  isK8sNamespaceType(c.type);

export const isK8sWorkloadComponent = (c: Component): c is K8sWorkloadComponent =>
  isK8sWorkloadType(c.type);

export const isK8sServiceComponent = (c: Component): c is K8sServiceComponent =>
  isK8sServiceType(c.type);

export const isK8sIngressComponent = (c: Component): c is K8sIngressComponent =>
  isK8sIngressType(c.type);

export const isK8sContainerComponent = (c: Component): c is K8sContainerComponent =>
  isK8sContainerType(c.type);

export const isSharedRefComponent = (c: Component): c is SharedRefComponent =>
  isSharedRefType(c.type);

export const isPluginTypedComponent = (c: Component): c is PluginTypedComponent =>
  isPluginComponentType(c.type);
