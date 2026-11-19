/** Which document pane is open: one at a time, shared by the toggles and the slot. */
let openPaneId: string | null = null;
const listeners = new Set<() => void>();
export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
export const getOpenPaneId = () => openPaneId;
export function setOpenPaneId(id: string | null) {
  openPaneId = id;
  listeners.forEach((listener) => listener());
}

/** Test-only: close any open pane between tests. */
export function resetDocumentPaneForTests() {
  setOpenPaneId(null);
}
