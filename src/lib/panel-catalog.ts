/**
 * Panel kinds for infrastructure grouping.
 * Used to represent Availability Zones, EKS/ECS clusters, subnets, VPC, etc.
 * When awsIconName is set, AwsIcon is used; otherwise the Lucide icon is used.
 */
import type { LucideIcon } from "lucide-react";
import { Square, MapPin } from "lucide-react";
import type { PanelKind } from "@/features/diagram";

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
    id: "default",
    label: "Painel",
    defaultName: "Novo Painel",
    defaultColor: "hsl(220 20% 20%)",
    icon: Square,
  },
  {
    id: "availability-zone",
    label: "Availability Zone",
    defaultName: "AZ-1",
    defaultColor: "hsl(45 60% 45%)",
    icon: MapPin,
    awsIconName: "ArchitectureGroupRegion",
  },
  {
    id: "eks-cluster",
    label: "EKS Cluster",
    defaultName: "EKS Cluster",
    defaultColor: "hsl(260 60% 45%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAmazonElasticKubernetesService",
  },
  {
    id: "ecs-cluster",
    label: "ECS Cluster",
    defaultName: "ECS Cluster",
    defaultColor: "hsl(200 70% 45%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAmazonElasticContainerService",
  },
  {
    id: "auto-scaling-group",
    label: "Auto Scaling Group",
    defaultName: "ASG",
    defaultColor: "hsl(25 80% 48%)",
    icon: Square,
    awsIconName: "ArchitectureServiceAWSAutoScaling",
  },
  {
    id: "vpc",
    label: "VPC",
    defaultName: "VPC",
    defaultColor: "hsl(220 50% 35%)",
    icon: Square,
    awsIconName: "ArchitectureGroupVirtualprivatecloudVPC",
  },
  {
    id: "public-subnet",
    label: "Public Subnet",
    defaultName: "Public Subnet",
    defaultColor: "hsl(150 50% 35%)",
    icon: Square,
    awsIconName: "ArchitectureGroupPublicsubnet",
  },
  {
    id: "private-subnet",
    label: "Private Subnet",
    defaultName: "Private Subnet",
    defaultColor: "hsl(0 50% 38%)",
    icon: Square,
    awsIconName: "ArchitectureGroupPrivatesubnet",
  },
];

export const PANEL_KIND_MAP = new Map(PANEL_KINDS.map((p) => [p.id, p]));

/** AWS service IDs that should be added as panels (PanelKind) instead of AWS components */
export const AWS_SERVICE_TO_PANEL_KIND: Record<string, PanelKind> = {
  "eks": "eks-cluster",
  "eks-2": "eks-cluster",
  "ecs": "ecs-cluster",
  "ecs-2": "ecs-cluster",
  "auto-scaling": "auto-scaling-group",
  "vpc": "vpc",
  "aws-vpc-group": "vpc",
  "public-subnet": "public-subnet",
  "private-subnet": "private-subnet",
  "aws-region": "availability-zone",
};

export function getPanelKindForAwsService(serviceId: string): PanelKind | undefined {
  return AWS_SERVICE_TO_PANEL_KIND[serviceId];
}

export function getPanelKindDef(kind: PanelKind | undefined): PanelKindDef {
  return PANEL_KIND_MAP.get(kind ?? "default") ?? PANEL_KINDS[0];
}
