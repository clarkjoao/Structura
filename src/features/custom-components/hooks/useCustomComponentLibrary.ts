import { useMemo } from "react";
import { useAllServices, useDiagramActions } from "@/features/diagram";
import { useCustomComponentStore } from "../store";
import { buildComponentPatchFromTemplate } from "../utils/customComponentTemplate.utils";

interface InstantiateTemplateParams {
  templateId: string;
  position: { x: number; y: number };
}

export function useCustomComponentLibrary() {
  const { addComponent, updateComponent } = useDiagramActions();
  const services = useAllServices();
  const templatesMap = useCustomComponentStore((state) => state.templates);
  const addTemplate = useCustomComponentStore((state) => state.addTemplate);
  const updateTemplate = useCustomComponentStore((state) => state.updateTemplate);
  const deleteTemplate = useCustomComponentStore((state) => state.deleteTemplate);

  const templates = useMemo(
    () => Object.values(templatesMap).sort((a, b) => b.updatedAt - a.updatedAt),
    [templatesMap],
  );
  const serviceIds = useMemo(() => new Set(services.map((service) => service.id)), [services]);

  const instantiateTemplate = ({ templateId, position }: InstantiateTemplateParams): string | null => {
    const template = templatesMap[templateId];
    if (!template) return null;
    const nameFromData =
      typeof template.data.name === "string" ? template.data.name : template.name;
    const component = addComponent(
      template.baseType,
      nameFromData,
      null,
      position,
    );
    const hasRegistryService = template.registryServiceId
      ? serviceIds.has(template.registryServiceId)
      : false;
    const patch = buildComponentPatchFromTemplate(template, hasRegistryService);
    updateComponent(component.id, patch);
    return component.id;
  };

  return {
    templates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    instantiateTemplate,
  };
}
