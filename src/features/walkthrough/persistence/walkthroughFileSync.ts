import { fileSystemAdapter } from "@/infrastructure/persistence/FileSystemAdapter";
import {
  createSidecarSync,
  type SidecarSync,
} from "@/infrastructure/persistence/createSidecarSync";
import { useWalkthroughStore } from "../store/walkthrough.store";
import type { WalkthroughPresentation } from "../model/walkthrough.types";
import {
  WALKTHROUGH_FILE_SUFFIX,
  fromWalkthroughFile,
  toWalkthroughFile,
} from "../model/walkthroughFile";

/**
 * Mirrors the walkthrough library into the connected workspace folder.
 *
 * The feature drives this, not the infrastructure: `fileSystemBoot` is always
 * loaded, and anything there that imported this store would pull the whole
 * walkthrough chunk into the app shell, past the feature flag that is supposed
 * to keep it out. The dependency points feature → infrastructure only, which is
 * the direction that costs nothing.
 *
 * Local storage keeps holding every walkthrough either way. The folder is a
 * mirror, so disconnecting it never empties the library.
 */
let sync: SidecarSync | null = null;

function createSync(): SidecarSync {
  return createSidecarSync<WalkthroughPresentation>({
    suffix: WALKTHROUGH_FILE_SUFFIX,
    host: fileSystemAdapter,
    getItems: () => useWalkthroughStore.getState().presentations,
    replaceItems: (next) => useWalkthroughStore.getState().replaceAll(next),
    subscribe: (onChange) =>
      useWalkthroughStore.subscribe((state, previous) => {
        if (state.presentations !== previous.presentations) onChange();
      }),
    folderIdOf: (presentation) => presentation.folderId ?? null,
    toFile: toWalkthroughFile,
    fromFile: fromWalkthroughFile,
  });
}

/**
 * Starts mirroring, and reconciles what is on disk with what is held locally.
 *
 * Called when the library opens rather than at boot: the scan is a directory
 * walk, and there is no reason to pay for it in a session that never looks at a
 * walkthrough. Safe to call more than once.
 */
export async function startWalkthroughFileSync(): Promise<void> {
  if (!fileSystemAdapter.isConnected) return;
  if (!sync) sync = createSync();
  await sync.hydrate();
}

export function stopWalkthroughFileSync(): void {
  sync?.stop();
  sync = null;
}

/** Write out anything pending, without waiting for the debounce. */
export async function flushWalkthroughFileSync(): Promise<void> {
  await sync?.flush();
}
