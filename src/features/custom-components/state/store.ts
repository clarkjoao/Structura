import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CustomComponentStoreState,
  CustomComponentTemplate,
} from "../customComponent.types";
import { customComponentRepository } from "@/infrastructure/persistence/CustomComponentRepository";

function syncRepository(templates: Record<string, CustomComponentTemplate>): void {
  void customComponentRepository.save(templates);
}

function isC4Subtype(value: unknown): value is "person" | "system" | "container" | "component" {
  return (
    value === "person" ||
    value === "system" ||
    value === "container" ||
    value === "component"
  );
}

export const useCustomComponentStore = create<CustomComponentStoreState>()(
  persist(
    (set, get) => ({
      templates: {},
      addTemplate: (template) => {
        const dataType = template.data?.type;
        const resolvedBaseType =
          isC4Subtype(dataType) ? dataType : template.baseType;
        const normalized = { ...template, baseType: resolvedBaseType };
        set((state) => ({
          templates: {
            ...state.templates,
            [normalized.id]: normalized,
          },
        }));
        syncRepository(get().templates);
      },
      updateTemplate: (id, partial) => {
        set((state) => {
          const existing = state.templates[id];
          if (!existing) return state;
          return {
            templates: {
              ...state.templates,
              [id]: {
                ...existing,
                ...partial,
                updatedAt: Date.now(),
              },
            },
          };
        });
        syncRepository(get().templates);
      },
      deleteTemplate: (id) => {
        set((state) => {
          const { [id]: _removed, ...nextTemplates } = state.templates;
          return {
            templates: nextTemplates,
          };
        });
        syncRepository(get().templates);
      },
      getTemplateById: (id) => get().templates[id],
    }),
    {
      name: "structura:custom-components",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ templates: state.templates }),
    },
  ),
);

void customComponentRepository.load().then((templates) => {
  if (Object.keys(templates).length === 0) return;
  useCustomComponentStore.setState((state) => {
    if (Object.keys(state.templates).length > 0) return state;
    return { templates };
  });
});
