/** Bridges UI that is outside `useFileSystemStorage` (e.g. storage banner) to the Navbar handler. */

let connectHandler: (() => void) | null = null;

export function registerConnectFolderRequestHandler(handler: (() => void) | null): void {
  connectHandler = handler;
}

export function requestConnectFolder(): void {
  connectHandler?.();
}
