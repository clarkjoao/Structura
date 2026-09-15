import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ElementPreset, ElementPresetStoreState } from "../types";
import { elementPresetStore } from "@/infrastructure/persistence/elementPresetStore";

/** Zustand persist key after F10. */
export const ELEMENT_PRESETS_ZUSTAND_KEY = "structura:element-presets";
/** Pre-F10 Zustand persist key — migrated once into the new key. */
export const LEGACY_CUSTOM_COMPONENTS_ZUSTAND_KEY = "structura:custom-components";

function syncRepository(presets: Record<string, ElementPreset>): void {
  void elementPresetStore.save(presets);
}

function isC4Subtype(value: unknown): value is "person" | "system" | "container" | "component" {
  return value === "person" || value === "system" || value === "container" || value === "component";
}

function normalizePreset(preset: ElementPreset): ElementPreset {
  const dataType = preset.data?.type;
  const resolvedBaseType = isC4Subtype(dataType) ? dataType : preset.baseType;
  const rawVersion = preset.templateVersion;
  const templateVersion =
    typeof rawVersion === "number" && Number.isFinite(rawVersion) && rawVersion >= 1
      ? rawVersion
      : 1;
  const category = preset.category?.trim() ? preset.category : "general";
  return {
    ...preset,
    baseType: resolvedBaseType,
    templateVersion,
    category,
  };
}

function migratePresets(presets: Record<string, ElementPreset>): Record<string, ElementPreset> {
  let changed = false;
  const next: Record<string, ElementPreset> = { ...presets };
  for (const [id, preset] of Object.entries(next)) {
    let row = preset;
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
  return changed ? next : presets;
}

/**
 * One-shot: copy Zustand persist payload from the pre-F10 key into the new key.
 *
 * Zustand does not rename storage keys; without this, saved presets would vanish
 * after the rename. Removes the legacy key after a successful copy.
 */
export function migrateZustandPresetStorageKey(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> = localStorage,
): boolean {
  const legacy = storage.getItem(LEGACY_CUSTOM_COMPONENTS_ZUSTAND_KEY);
  if (legacy === null) return false;
  if (storage.getItem(ELEMENT_PRESETS_ZUSTAND_KEY) === null) {
    storage.setItem(ELEMENT_PRESETS_ZUSTAND_KEY, legacy);
  }
  storage.removeItem(LEGACY_CUSTOM_COMPONENTS_ZUSTAND_KEY);
  return true;
}

migrateZustandPresetStorageKey();

export const useElementPresetStore = create<ElementPresetStoreState>()(
  persist(
    (set, get) => ({
      presets: {},
      addPreset: (preset) => {
        const normalized = normalizePreset(preset);
        set((state) => ({
          presets: {
            ...state.presets,
            [normalized.id]: normalized,
          },
        }));
        syncRepository(get().presets);
      },
      updatePreset: (id, partial) => {
        set((state) => {
          const existing = state.presets[id];
          if (!existing) return state;
          return {
            presets: {
              ...state.presets,
              [id]: {
                ...existing,
                ...partial,
                templateVersion: existing.templateVersion + 1,
                updatedAt: Date.now(),
              },
            },
          };
        });
        syncRepository(get().presets);
      },
      deletePreset: (id) => {
        set((state) => {
          const { [id]: _removed, ...nextPresets } = state.presets;
          return {
            presets: nextPresets,
          };
        });
        syncRepository(get().presets);
      },
      getPresetById: (id) => get().presets[id] ?? null,
    }),
    {
      name: ELEMENT_PRESETS_ZUSTAND_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ presets: state.presets }),
      // Pre-F10 persisted `{ templates: ... }` under the migrated key blob.
      merge: (persisted, current) => {
        const raw = persisted as { presets?: unknown; templates?: unknown } | null;
        const fromNew = raw?.presets;
        const fromLegacyField = raw?.templates;
        const source =
          fromNew && typeof fromNew === "object"
            ? (fromNew as Record<string, ElementPreset>)
            : fromLegacyField && typeof fromLegacyField === "object"
              ? (fromLegacyField as Record<string, ElementPreset>)
              : {};
        return {
          ...current,
          presets: migratePresets(source),
        };
      },
    },
  ),
);

void useElementPresetStore.persist.onFinishHydration(() => {
  useElementPresetStore.setState((state) => {
    const migrated = migratePresets(state.presets);
    if (migrated === state.presets) return state;
    return { presets: migrated };
  });
});

void elementPresetStore.load().then((presets) => {
  if (Object.keys(presets).length === 0) return;
  useElementPresetStore.setState((state) => {
    if (Object.keys(state.presets).length > 0) return state;
    return { presets: migratePresets(presets) };
  });
});
