import { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { SEED_PL_DIAGRAMS, SEED_PL_FOLDERS, SEED_PL_SERVICES } from "./pixledger";

export const SEED_SERVICES: Record<string, ServiceDefinition> = {
  ...SEED_PL_SERVICES,
};

export const SEED_DIAGRAMS: Record<string, Diagram> = {
  ...SEED_PL_DIAGRAMS,
};

export const SEED_FOLDERS: Record<string, Folder> = {
  ...SEED_PL_FOLDERS,
};
