import { Network, Server, Database, User } from "lucide-react";

export const TypeConfig: Record<
  string,
  { icon: typeof Network; borderColor: string; textColor: string }
> = {
  person: {
    icon: User,
    borderColor: "border-l-node-person",
    textColor: "text-node-person",
  },
  system: {
    icon: Network,
    borderColor: "border-l-node-system",
    textColor: "text-node-system",
  },
  container: {
    icon: Server,
    borderColor: "border-l-node-container",
    textColor: "text-node-container",
  },
  component: {
    icon: Database,
    borderColor: "border-l-node-component",
    textColor: "text-node-component",
  },
};

export const awsCategoryBorders: Record<string, string> = {
  "aws-compute": "border-l-aws-compute",
  "aws-storage": "border-l-aws-storage",
  "aws-database": "border-l-aws-database",
  "aws-networking": "border-l-aws-networking",
  "aws-security": "border-l-aws-security",
  "aws-analytics": "border-l-aws-analytics",
  "aws-ml": "border-l-aws-ml",
  "aws-integration": "border-l-aws-integration",
  "aws-management": "border-l-aws-management",
  "aws-developer": "border-l-aws-developer",
  "aws-containers": "border-l-aws-containers",
  "aws-media": "border-l-aws-media",
  "aws-migration": "border-l-aws-migration",
  "aws-iot": "border-l-aws-iot",
  "aws-end-user": "border-l-aws-end-user",
  "aws-general": "border-l-aws-general",
};
