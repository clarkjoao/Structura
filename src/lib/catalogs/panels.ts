import type { LucideIcon } from "lucide-react";
import { Square, MapPin, LayoutList } from "lucide-react";
// Leaf import: this catalog only needs the enum, and going through the
// `@/features/diagram` barrel would pull the store in behind it.
import { PanelKind } from "@/features/diagram/enums";
import i18n from "@/infrastructure/i18n";

export interface PanelKindDef {
  id: PanelKind;
  /** i18n key for the kind's display name; resolve with `panelKindLabel`. */
  labelKey: string;
  /** i18n key for the name a new panel of this kind gets. */
  defaultNameKey: string;
  defaultColor: string;

  icon: LucideIcon;

  awsIconName?: string;
}

export const PANEL_KINDS: PanelKindDef[] = [
  {
    id: PanelKind.Default,
    labelKey: "panelKinds.default.label",
    defaultNameKey: "panelKinds.default.defaultName",
    defaultColor: "hsl(220 20% 20%)",
    icon: Square,
  },
  {
    id: PanelKind.AvailabilityZone,
    labelKey: "panelKinds.availability-zone.label",
    defaultNameKey: "panelKinds.availability-zone.defaultName",
    defaultColor: "hsl(45 60% 45%)",
    icon: MapPin,
    awsIconName: "ArchitectureGroupRegion",
  },
  {
    id: PanelKind.EksCluster,
    labelKey: "panelKinds.eks-cluster.label",
    defaultNameKey: "panelKinds.eks-cluster.defaultName",
    defaultColor: "hsl(260 60% 45%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAmazonElasticKubernetesService",
  },
  {
    id: PanelKind.EcsCluster,
    labelKey: "panelKinds.ecs-cluster.label",
    defaultNameKey: "panelKinds.ecs-cluster.defaultName",
    defaultColor: "hsl(200 70% 45%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAmazonElasticContainerService",
  },
  {
    id: PanelKind.AutoScalingGroup,
    labelKey: "panelKinds.auto-scaling-group.label",
    defaultNameKey: "panelKinds.auto-scaling-group.defaultName",
    defaultColor: "hsl(25 80% 48%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAWSAutoScaling",
  },
  {
    id: PanelKind.Vpc,
    labelKey: "panelKinds.vpc.label",
    defaultNameKey: "panelKinds.vpc.defaultName",
    defaultColor: "hsl(220 50% 35%)",
    icon: Square,
    awsIconName: "ArchitectureGroupVirtualprivatecloudVPC",
  },
  {
    id: PanelKind.PublicSubnet,
    labelKey: "panelKinds.public-subnet.label",
    defaultNameKey: "panelKinds.public-subnet.defaultName",
    defaultColor: "hsl(150 50% 35%)",
    icon: Square,
    awsIconName: "ArchitectureGroupPublicsubnet",
  },
  {
    id: PanelKind.PrivateSubnet,
    labelKey: "panelKinds.private-subnet.label",
    defaultNameKey: "panelKinds.private-subnet.defaultName",
    defaultColor: "hsl(0 50% 38%)",
    icon: Square,
    awsIconName: "ArchitectureGroupPrivatesubnet",
  },
  {
    id: PanelKind.Swimlane,
    labelKey: "panelKinds.swimlane.label",
    defaultNameKey: "panelKinds.swimlane.defaultName",
    defaultColor: "#6366f1",
    icon: LayoutList,
  },
];

export const PANEL_KIND_MAP = new Map(PANEL_KINDS.map((p) => [p.id, p]));

export const AWS_SERVICE_TO_PANEL_KIND: Record<string, PanelKind> = {
  eks: PanelKind.EksCluster,
  "eks-2": PanelKind.EksCluster,
  ecs: PanelKind.EcsCluster,
  "ecs-2": PanelKind.EcsCluster,
  "auto-scaling": PanelKind.AutoScalingGroup,
  vpc: PanelKind.Vpc,
  "aws-vpc-group": PanelKind.Vpc,
  "public-subnet": PanelKind.PublicSubnet,
  "private-subnet": PanelKind.PrivateSubnet,
  "aws-region": PanelKind.AvailabilityZone,
};

export function getPanelKindForAwsService(serviceId: string): PanelKind | undefined {
  return AWS_SERVICE_TO_PANEL_KIND[serviceId];
}

export function getPanelKindDef(kind: PanelKind | undefined): PanelKindDef {
  return PANEL_KIND_MAP.get(kind ?? PanelKind.Default) ?? PANEL_KINDS[0];
}

/**
 * The definition for a kind that may arrive as a bare string.
 *
 * Node data carries `panelKind` as a plain string — React Flow data is not the
 * domain model — so the label helpers take the wider type rather than making
 * every caller cast back into the enum.
 */
function defFor(kind: PanelKind | string | undefined): PanelKindDef {
  return PANEL_KIND_MAP.get((kind ?? PanelKind.Default) as PanelKind) ?? PANEL_KINDS[0];
}

/** The kind's display name in the active locale. */
export function panelKindLabel(kind: PanelKind | string | undefined): string {
  return i18n.t(defFor(kind).labelKey);
}

/** The name a new panel of this kind is created with, in the active locale. */
export function panelKindDefaultName(kind: PanelKind | string | undefined): string {
  return i18n.t(defFor(kind).defaultNameKey);
}
