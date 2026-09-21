/**
 * A reference to a single scene within a walkthrough presentation.
 * Each scene points to one diagram + one flow within that diagram.
 */
export interface WalkthroughStepRef {
  /**
   * This scene's own identity, stable across reordering.
   *
   * Scenes used to be known by their position, which is what the rail keyed
   * its rows on — so dragging one past another handed a row the wrong scene's
   * state. Backfilled on read by `ensureStepIds` for walkthroughs recorded
   * before the field existed.
   */
  id: string;
  diagramId: string;
  flowId: string;
  /** Override title shown for this step in the player/editor; undefined = use the flow's name */
  label?: string;
  /**
   * A note the author attaches to this scene, shown to the reader while the
   * scene plays — beside the diagram, not inside it.
   *
   * It used to be editor-only, which is why it was called an author note. It
   * is the author's note *about* the scene, not a note kept from the reader;
   * `WalkthroughPresentation.authorNotes` is the one that stays private.
   */
  note?: string;
}

/**
 * A walkthrough presentation — an ordered sequence of scenes that a reader
 * moves through, each scene being one flow of one diagram.
 */
export interface WalkthroughPresentation {
  id: string;
  title: string;
  description?: string;
  /** Notes visible only to the author in the editor; not shown to readers */
  authorNotes?: string;
  /**
   * Optional reference to an existing Workspace folder. The walkthrough store
   * only holds the id — the folder itself lives in the diagram store. Read-only
   * across the boundary: walkthroughs never write to the diagram store.
   */
  folderId?: string | null;
  steps: WalkthroughStepRef[];
  createdAt: number;
  updatedAt: number;
}
