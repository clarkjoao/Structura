import { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { SEED_PL_DIAGRAMS, SEED_PL_FOLDERS, SEED_PL_SERVICE_REGISTRY } from "./pixledger";

export const SEED_SERVICE_REGISTRY: Record<string, ServiceDefinition> = {
  ...SEED_PL_SERVICE_REGISTRY,
};

export const SEED_DIAGRAMS: Record<string, Diagram> = {
  ...SEED_PL_DIAGRAMS,
};

export const SEED_FOLDERS: Record<string, Folder> = {
  ...SEED_PL_FOLDERS,
};
