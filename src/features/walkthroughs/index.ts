export type { Walkthrough, WalkthroughStep } from "./types";

/** @deprecated Use `Walkthrough`. Kept as an alias for one release. */
export type { Walkthrough as Journey } from "./types";
/** @deprecated Use `WalkthroughStep`. Kept as an alias for one release. */
export type { WalkthroughStep as JourneyStep } from "./types";

export { useWalkthroughsStore } from "./store/walkthroughs.store";
/** @deprecated Use `useWalkthroughsStore`. */
export { useWalkthroughsStore as useJourneysStore } from "./store/walkthroughs.store";

export type { SelectStepPlaybackOptions } from "./hooks/useWalkthroughGlobalPlayer";
export { useWalkthroughGlobalPlayer } from "./hooks/useWalkthroughGlobalPlayer";

export { CreateWalkthroughModal } from "./components/CreateWalkthroughModal";
/** @deprecated Use `CreateWalkthroughModal`. */
export { CreateWalkthroughModal as CreateJourneyModal } from "./components/CreateWalkthroughModal";

export { WalkthroughCard } from "./components/WalkthroughCard";
/** @deprecated Use `WalkthroughCard`. */
export { WalkthroughCard as JourneyCard } from "./components/WalkthroughCard";

export { AddStepModal } from "./components/editor/AddStepModal.tsx";
export { WalkthroughEditorCanvas } from "./components/editor/WalkthroughEditorCanvas.tsx";
/** @deprecated Use `WalkthroughEditorCanvas`. */
export { WalkthroughEditorCanvas as JourneyEditorCanvas } from "./components/editor/WalkthroughEditorCanvas.tsx";

export { WalkthroughCompletedOverlay } from "./components/editor/WalkthroughCompletedOverlay.tsx";
/** @deprecated Use `WalkthroughCompletedOverlay`. */
export { WalkthroughCompletedOverlay as JourneyCompletedOverlay } from "./components/editor/WalkthroughCompletedOverlay.tsx";

export { RightPanel } from "./components/editor/RightPanel.tsx";
export { StepDetail } from "./components/editor/StepDetail.tsx";
export { StepFlowSection } from "./components/editor/StepFlowSection.tsx";
export { StepList } from "./components/editor/StepList.tsx";

export {
  useAllWalkthroughs,
  useWalkthroughActions,
  useWalkthrough,
  useWalkthroughById,
  useWalkthroughSteps,
  useWalkthroughs,
  useWalkthroughsByDiagramId,
} from "./store/selectors/walkthroughs.selectors";

/** @deprecated Use the `useWalkthrough*` family. */
export {
  useAllWalkthroughs as useAllJourneys,
  useWalkthroughActions as useJourneyActions,
  useWalkthrough as useJourney,
  useWalkthroughById as useJourneyById,
  useWalkthroughSteps as useJourneySteps,
  useWalkthroughs as useJourneys,
  useWalkthroughsByDiagramId as useJourneysByDiagramId,
} from "./store/selectors/walkthroughs.selectors";

export { WalkthroughPlayerBar } from "./components/WalkthroughPlayerBar";
/** @deprecated Use `WalkthroughPlayerBar`. */
export { WalkthroughPlayerBar as JourneyPlayerBar } from "./components/WalkthroughPlayerBar";

export { WalkthroughPlayerProvider } from "./components/WalkthroughPlayerContext";
/** @deprecated Use `WalkthroughPlayerProvider`. */
export { WalkthroughPlayerProvider as JourneyPlayerProvider } from "./components/WalkthroughPlayerContext";

export { useWalkthroughPlayer } from "./hooks/useWalkthroughPlayer";
/** @deprecated Use `useWalkthroughPlayer`. */
export { useWalkthroughPlayer as useJourneyPlayer } from "./hooks/useWalkthroughPlayer";
