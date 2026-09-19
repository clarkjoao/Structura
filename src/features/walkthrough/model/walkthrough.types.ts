/**
 * A reference to a single scene within a walkthrough presentation.
 * Each scene points to one diagram + one flow within that diagram.
 */
export interface WalkthroughStepRef {
  diagramId: string;
  flowId: string;
  /** Override title shown for this step in the player/editor; undefined = use the flow's name */
  label?: string;
  /** Author note visible only during editing, not shown to readers */
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
  steps: WalkthroughStepRef[];
  createdAt: number;
  updatedAt: number;
}
