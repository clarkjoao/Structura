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
