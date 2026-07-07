import type { ComponentType } from "@/features/diagram";

export interface CustomComponentTemplate {
  id: string;
  name: string;
  description?: string;

  category?: string;
  baseType: ComponentType;
  data: Record<string, unknown>;
  serviceId?: string;

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
