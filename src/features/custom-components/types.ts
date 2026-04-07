import type { ComponentType } from "@/features/diagram";

export interface CustomComponentTemplate {
  id: string;
  name: string;
  description?: string;
  /** Grouping label for the template library UI */
  category?: string;
  baseType: ComponentType;
  data: Record<string, unknown>;
  registryServiceId?: string;
  /** Increments on each persisted update */
  templateVersion: number;
  createdAt: number;
  updatedAt: number;
}

export interface CustomComponentStoreState {
  templates: Record<string, CustomComponentTemplate>;
  addTemplate: (template: CustomComponentTemplate) => void;
  updateTemplate: (
    id: string,
    partial: Partial<Omit<CustomComponentTemplate, "id" | "createdAt" | "templateVersion">>,
  ) => void;
  deleteTemplate: (id: string) => void;
  getTemplateById: (id: string) => CustomComponentTemplate | null;
}
