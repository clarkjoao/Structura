import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  CustomComponentStoreState,
  CustomComponentTemplate,
} from "../types";
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

function normalizeTemplate(template: CustomComponentTemplate): CustomComponentTemplate {
  const dataType = template.data?.type;
  const resolvedBaseType = isC4Subtype(dataType) ? dataType : template.baseType;
  const rawVersion = template.templateVersion;
  const templateVersion =
    typeof rawVersion === "number" && Number.isFinite(rawVersion) && rawVersion >= 1
      ? rawVersion
      : 1;
  const category = template.category?.trim() ? template.category : "general";
  return {
    ...template,
    baseType: resolvedBaseType,
    templateVersion,
    category,
  };
}

function migrateTemplates(
  templates: Record<string, CustomComponentTemplate>,
): Record<string, CustomComponentTemplate> {
  let changed = false;
  const next: Record<string, CustomComponentTemplate> = { ...templates };
  for (const [id, template] of Object.entries(next)) {
    let row = template;
    const version = row.templateVersion;
    if (typeof version !== "number" || !Number.isFinite(version)) {
      row = { ...row, templateVersion: 1 };
      changed = true;
    }
    const category = row.category?.trim() ?? "";
    if (category.length === 0) {
      row = { ...row, category: "general" };
      changed = true;
    }
    next[id] = row;
  }
  return changed ? next : templates;
}

export const useCustomComponentStore = create<CustomComponentStoreState>()(
  persist(
    (set, get) => ({
      templates: {},
      addTemplate: (template) => {
        const normalized = normalizeTemplate(template);
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
                templateVersion: existing.templateVersion + 1,
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
      getTemplateById: (id) => get().templates[id] ?? null,
    }),
    {
      name: "structura:custom-components",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ templates: state.templates }),
    },
  ),
);

void useCustomComponentStore.persist.onFinishHydration(() => {
  useCustomComponentStore.setState((state) => {
    const migrated = migrateTemplates(state.templates);
    if (migrated === state.templates) return state;
    return { templates: migrated };
  });
});

void customComponentRepository.load().then((templates) => {
  if (Object.keys(templates).length === 0) return;
  useCustomComponentStore.setState((state) => {
    if (Object.keys(state.templates).length > 0) return state;
    return { templates: migrateTemplates(templates) };
  });
});
