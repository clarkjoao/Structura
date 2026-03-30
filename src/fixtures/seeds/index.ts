import { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { SEED_BC_SERVICE_REGISTRY, SEED_BC_DIAGRAMS, SEED_BC_FOLDERS } from "./banking-example";
import { SEED_FTECH_SERVICE_REGISTRY, SEED_FTECH_DIAGRAMS, SEED_FTECH_FOLDERS } from "./fintech-example"; 

export const SEED_SERVICE_REGISTRY: Record<string, ServiceDefinition> = { ...SEED_BC_SERVICE_REGISTRY, ...SEED_FTECH_SERVICE_REGISTRY };
export const SEED_DIAGRAMS: Record<string, Diagram>                    = { ...SEED_BC_DIAGRAMS, ...SEED_FTECH_DIAGRAMS };
export const SEED_FOLDERS: Record<string, Folder>                      = { ...SEED_BC_FOLDERS, ...SEED_FTECH_FOLDERS };
