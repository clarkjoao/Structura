import type { UserTemplate } from "../../model/diagram.types";
import type { AppState } from "../store.types";

export function userTemplatesSlice(
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) {
  return {
    userTemplates: {},

    saveUserTemplate: (template: UserTemplate): void => {
      set((state) => {
        state.userTemplates[template.id] = template;
      });
    },

    updateUserTemplate: (
      id: string,
      patch: Partial<Pick<UserTemplate, "name" | "description" | "category">>,
    ): void => {
      set((state) => {
        const existing = state.userTemplates[id];
        if (!existing) return;
        Object.assign(existing, patch);
      });
    },

    deleteUserTemplate: (id: string): void => {
      set((state) => {
        delete state.userTemplates[id];
      });
    },
  };
}
