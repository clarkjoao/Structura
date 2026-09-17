/**
 * BroadcastChannel for cross-tab coordination on the same OPFS workspace.
 *
 * When one tab successfully flushes to the folder, it broadcasts a "manifest changed"
 * event. Other connected tabs receive this and re-check the manifest fingerprint —
 * if it differs from their last-synced value, they surface a merge dialog so the
 * user can decide how to reconcile the remote changes.
 *
 * The BroadcastChannel API is available in all modern browsers (Chromium, Firefox,
 * Safari 15.4+). Falls back silently if unavailable.
 */

const CHANNEL_NAME = "structura-workspace-sync";

export interface WorkspaceBroadcastPayload {
  type: "manifest-changed";
  /** Workspace path (directory name) to filter broadcasts to the same workspace. */
  workspacePath: string;
}

let _channel: BroadcastChannel | null = null;
let _onRemoteChange: (() => void) | null = null;

/**
 * Opens the broadcast channel and registers a handler for incoming messages.
 * Subsequent calls replace the handler. Safe to call multiple times.
 */
export function openWorkspaceBroadcast(
  workspacePath: string,
  onRemoteChange: () => void,
): void {
  _onRemoteChange = onRemoteChange;

  if (typeof BroadcastChannel === "undefined") return;

  if (_channel) {
    _channel.close();
  }

  _channel = new BroadcastChannel(CHANNEL_NAME);
  _channel.onmessage = (event: MessageEvent<WorkspaceBroadcastPayload>) => {
    const { type, workspacePath: incomingPath } = event.data;
    if (type === "manifest-changed" && incomingPath === workspacePath) {
      _onRemoteChange?.();
    }
  };
}

/**
 * Broadcasts that the manifest has changed to all other connected tabs.
 * Idempotent — no-op if the channel is not open.
 */
export function broadcastManifestChanged(workspacePath: string): void {
  if (!_channel) return;
  _channel.postMessage({
    type: "manifest-changed",
    workspacePath,
  } satisfies WorkspaceBroadcastPayload);
}

/** Closes the channel and clears the handler. Call on disconnect. */
export function closeWorkspaceBroadcast(): void {
  _onRemoteChange = null;
  if (_channel) {
    _channel.close();
    _channel = null;
  }
}
