import type { ComponentType } from "@/features/diagram";

export interface CustomComponentTemplate {
  id: string;
  name: string;
  description?: string;
  baseType: ComponentType;
  data: Record<string, unknown>;
  registryServiceId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CustomComponentStoreState {
  templates: Record<string, CustomComponentTemplate>;
  addTemplate: (template: CustomComponentTemplate) => void;
  updateTemplate: (
    id: string,
    partial: Partial<Omit<CustomComponentTemplate, "id" | "createdAt">>,
  ) => void;
  deleteTemplate: (id: string) => void;
  getTemplateById: (id: string) => CustomComponentTemplate | undefined;
}
