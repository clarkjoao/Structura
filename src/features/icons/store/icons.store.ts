import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { IconDefinition } from "@/features/diagram";

interface IconStoreState {
  icons: Record<string, IconDefinition>;
  addIcon: (icon: IconDefinition) => void;
  removeIcon: (iconId: string) => void;
  updateIconName: (iconId: string, name: string) => void;
  incrementIconUsage: (iconId: string) => void;
  decrementIconUsage: (iconId: string) => void;
  getIconById: (iconId: string) => IconDefinition | undefined;
}

export const useIconStore = create<IconStoreState>()(
  persist(
    (set, get) => ({
      icons: {},

      addIcon: (icon) =>
        set((state) => ({
          icons: { ...state.icons, [icon.id]: icon },
        })),

      removeIcon: (iconId) =>
        set((state) => {
          const { [iconId]: _removed, ...rest } = state.icons;
          return { icons: rest };
        }),

      updateIconName: (iconId, name) =>
        set((state) => {
          const existing = state.icons[iconId];
          if (!existing) return state;
          return {
            icons: { ...state.icons, [iconId]: { ...existing, name } },
          };
        }),

      incrementIconUsage: (iconId) =>
        set((state) => {
          const icon = state.icons[iconId];
          if (!icon) return state;
          return {
            icons: {
              ...state.icons,
              [iconId]: { ...icon, usageCount: icon.usageCount + 1 },
            },
          };
        }),

      decrementIconUsage: (iconId) =>
        set((state) => {
          const icon = state.icons[iconId];
          if (!icon) return state;
          return {
            icons: {
              ...state.icons,
              [iconId]: {
                ...icon,
                usageCount: Math.max(0, icon.usageCount - 1),
              },
            },
          };
        }),

      getIconById: (iconId) => get().icons[iconId],
    }),
    {
      name: "structura:icon-library",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ icons: state.icons }),
    },
  ),
);
