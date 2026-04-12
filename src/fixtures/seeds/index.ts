import { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { SEED_US_DIAGRAMS, SEED_US_FOLDERS, SEED_US_SERVICE_REGISTRY } from "./urlshort-example";

export const SEED_SERVICE_REGISTRY: Record<string, ServiceDefinition> = {
  ...SEED_US_SERVICE_REGISTRY,
};

export const SEED_DIAGRAMS: Record<string, Diagram> = {
  ...SEED_US_DIAGRAMS,
};

export const SEED_FOLDERS: Record<string, Folder> = {
  ...SEED_US_FOLDERS,
};