import { defaultStorage } from "@/infrastructure/persistence/LocalStorageAdapter";
import { recordLocalStorageDiagramSyncSuccess } from "@/infrastructure/persistence/localStorageSyncTimestamp";
import { buildPersistStoragePayload, PERSIST_KEY } from "./persist.config";
import {
  createDiagramStore,
  selectClipboardActions,
  selectComponentActions,
  selectConnectionActions,
  selectDiagramActions,
  selectIconActions,
  selectLayoutActions,
  selectServiceActions,
  selectVersionActions,
} from "./diagram.store";
import type { UserTemplate } from "../model/diagram.types";

/**
 * The default `useDiagramStore` singleton. Wired to the default
 * `LocalStorageAdapter` so the diagram feature has a working store at module
 * load without the persistence layer needing to know about Zustand.
 *
 * Live in this leaf file (rather than `diagram.store.ts`) so the factory and
 * its type selectors can stay free of any runtime import from
 * `@/infrastructure/persistence` — which would close a cycle through
 * `infrastructure/persistence/index.ts` back into `@/features/diagram`.
 */
export const useDiagramStore = createDiagramStore(defaultStorage);

export async function flushDiagramStoreToLocalStorageNow(
  options: { force?: boolean } = {},
): Promise<boolean> {
  const payload = buildPersistStoragePayload(useDiagramStore.getState());

  if (defaultStorage.paused && !options.force) {
    return false;
  }

  if (defaultStorage.paused && options.force) {
    const ok = await defaultStorage.forceSave(PERSIST_KEY, payload);
    if (ok) {
      recordLocalStorageDiagramSyncSuccess();
    }
    return ok;
  }

  const json = JSON.stringify({
    state: payload.state,
    version: payload.version,
  });
  await defaultStorage.setItem(PERSIST_KEY, json);
  recordLocalStorageDiagramSyncSuccess();
  return true;
}

/**
 * Best-effort synchronous persist on tab close. Uses the same semantics as
 * {@link flushDiagramStoreToLocalStorageNow} with `{ force: true }` when folder sync pauses local writes.
 */
export function flushDiagramStoreToLocalStorageBeforeUnloadSync(): void {
  const payload = buildPersistStoragePayload(useDiagramStore.getState());

  if (defaultStorage.paused) {
    const ok = defaultStorage.forceSaveSync(PERSIST_KEY, payload);
    if (ok) {
      recordLocalStorageDiagramSyncSuccess();
    }
    return;
  }

  const json = JSON.stringify({
    state: payload.state,
    version: payload.version,
  });
  defaultStorage.setItemSync(PERSIST_KEY, json);
  recordLocalStorageDiagramSyncSuccess();
}

export function updateDiagramDescription(diagramId: string, description: string): void {
  useDiagramStore.getState().updateDiagramDescription(diagramId, description);
}

export function saveUserTemplate(template: UserTemplate): void {
  useDiagramStore.getState().saveUserTemplate(template);
}

export function updateUserTemplate(
  id: string,
  patch: Partial<Pick<UserTemplate, "name" | "description" | "category">>,
): void {
  useDiagramStore.getState().updateUserTemplate(id, patch);
}

export function deleteUserTemplate(id: string): void {
  useDiagramStore.getState().deleteUserTemplate(id);
}

// --- Action hooks (one per slice/domain) -------------------------------------

export const useDiagramActions = () => useDiagramStore(selectDiagramActions);

// --- Domain-scoped action hooks ---

export const useComponentActions = () => useDiagramStore(selectComponentActions);

export const useConnectionActions = () => useDiagramStore(selectConnectionActions);

export const useLayoutActions = () => useDiagramStore(selectLayoutActions);

export const useVersionActions = () => useDiagramStore(selectVersionActions);

export const useClipboardActions = () => useDiagramStore(selectClipboardActions);

export const useIconActions = () => useDiagramStore(selectIconActions);

export const useServiceActions = () => useDiagramStore(selectServiceActions);
