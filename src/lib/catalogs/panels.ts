/**
 * Panel kinds for infrastructure grouping.
 * Used to represent Availability Zones, EKS/ECS clusters, subnets, VPC, etc.
 * When awsIconName is set, AwsIcon is used; otherwise the Lucide icon is used.
 */
import type { LucideIcon } from "lucide-react";
import { Square, MapPin, LayoutList } from "lucide-react";
import { PanelKind } from "@/features/diagram";

export interface PanelKindDef {
  id: PanelKind;
  label: string;
  defaultName: string;
  defaultColor: string;
  /** Lucide icon — used when awsIconName is not set */
  icon: LucideIcon;
  /** AWS icon from aws-react-icons — when set, used instead of icon */
  awsIconName?: string;
}

export const PANEL_KINDS: PanelKindDef[] = [
  {
    id: PanelKind.Default,
    label: "Painel",
    defaultName: "Novo Painel",
    defaultColor: "hsl(220 20% 20%)",
    icon: Square,
  },
  {
    id: PanelKind.AvailabilityZone,
    label: "Availability Zone",
    defaultName: "AZ-1",
    defaultColor: "hsl(45 60% 45%)",
    icon: MapPin,
    awsIconName: "ArchitectureGroupRegion",
  },
  {
    id: PanelKind.EksCluster,
    label: "EKS Cluster",
    defaultName: "EKS Cluster",
    defaultColor: "hsl(260 60% 45%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAmazonElasticKubernetesService",
  },
  {
    id: PanelKind.EcsCluster,
    label: "ECS Cluster",
    defaultName: "ECS Cluster",
    defaultColor: "hsl(200 70% 45%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAmazonElasticContainerService",
  },
  {
    id: PanelKind.AutoScalingGroup,
    label: "Auto Scaling Group",
    defaultName: "ASG",
    defaultColor: "hsl(25 80% 48%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAWSAutoScaling",
  },
  {
    id: PanelKind.Vpc,
    label: "VPC",
    defaultName: "VPC",
    defaultColor: "hsl(220 50% 35%)",
    icon: Square,
    awsIconName: "ArchitectureGroupVirtualprivatecloudVPC",
  },
  {
    id: PanelKind.PublicSubnet,
    label: "Public Subnet",
    defaultName: "Public Subnet",
    defaultColor: "hsl(150 50% 35%)",
    icon: Square,
    awsIconName: "ArchitectureGroupPublicsubnet",
  },
  {
    id: PanelKind.PrivateSubnet,
    label: "Private Subnet",
    defaultName: "Private Subnet",
    defaultColor: "hsl(0 50% 38%)",
    icon: Square,
    awsIconName: "ArchitectureGroupPrivatesubnet",
  },
  {
    id: PanelKind.Swimlane,
    label: "Swim lane",
    defaultName: "Swim lane",
    defaultColor: "#6366f1",
    icon: LayoutList,
  },
];

export const PANEL_KIND_MAP = new Map(PANEL_KINDS.map((p) => [p.id, p]));

/** AWS service IDs that should be added as panels (PanelKind) instead of AWS components */
export const AWS_SERVICE_TO_PANEL_KIND: Record<string, PanelKind> = {
  "eks": PanelKind.EksCluster,
  "eks-2": PanelKind.EksCluster,
  "ecs": PanelKind.EcsCluster,
  "ecs-2": PanelKind.EcsCluster,
  "auto-scaling": PanelKind.AutoScalingGroup,
  "vpc": PanelKind.Vpc,
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
