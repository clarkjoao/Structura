import { createContext, useContext } from "react";
import type { FlowStep } from "@/features/diagram";

export interface RecordingModeState {
  isRecording: boolean;
  recordingSteps: FlowStep[];
  onRecordNodeClick?: (nodeId: string) => void;
  onRecordEdgeClick?: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick?: (nodeId: string, handleId: string) => void;
  onRecordUndo?: () => void;
}

const defaultState: RecordingModeState = {
  isRecording: false,
  recordingSteps: [],
};

const RecordingModeContext = createContext<RecordingModeState>(defaultState);

export const RecordingModeProvider = RecordingModeContext.Provider;

export function useRecordingMode(): RecordingModeState {
  return useContext(RecordingModeContext);
}
