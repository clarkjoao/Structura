import { createContext, useContext, useState, useCallback } from "react";
import type { FlowStep, Flow } from "@/features/diagram";

export interface RecordingFinalizeData {
  name: string;
  description: string;
  tags: string[];
  steps: FlowStep[];
  editingFlowId: string | null;
}

export interface RecordingModeState {
  isRecording: boolean;
  recordingSteps: FlowStep[];
  recordingName: string;
  recordingDescription: string;
  recordingTags: string[];
  editingFlowId: string | null;
  setRecordingName: (name: string) => void;
  setRecordingDescription: (desc: string) => void;
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  onUpdateStepDescription: (index: number, description: string) => void;
  onUpdateStepDuration: (index: number, duration: string) => void;
  onUpdateStepPayload: (index: number, payload: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onRecordNodeClick?: (nodeId: string) => void;
  onRecordEdgeClick?: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick?: (nodeId: string, handleId: string) => void;
  onRecordUndo?: () => void;
  startRecording: () => void;
  cancelRecording: () => void;
  finalizeRecording: () => void;
  editFlow: (flow: Flow) => void;
}

const noop = () => {};
const defaultState: RecordingModeState = {
  isRecording: false,
  recordingSteps: [],
  recordingName: "",
  recordingDescription: "",
  recordingTags: [],
  editingFlowId: null,
  setRecordingName: noop,
  setRecordingDescription: noop,
  onAddTag: noop,
  onRemoveTag: noop,
  onUpdateStepDescription: noop,
  onUpdateStepDuration: noop,
  onUpdateStepPayload: noop,
  onUpdateStepPayloadDirection: noop,
  onDeleteStep: noop,
  onReorderSteps: noop,
  startRecording: noop,
  cancelRecording: noop,
  finalizeRecording: noop,
  editFlow: noop,
};

const RecordingModeContext = createContext<RecordingModeState>(defaultState);

export const RecordingModeProvider = RecordingModeContext.Provider;

export function useRecordingMode(): RecordingModeState {
  return useContext(RecordingModeContext);
}

interface RecordingModeStateProviderProps {
  children: React.ReactNode;
  onFinalize: (data: RecordingFinalizeData) => void;
  onStartRecording?: () => void;
}

export function RecordingModeStateProvider({
  children,
  onFinalize,
  onStartRecording,
}: RecordingModeStateProviderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSteps, setRecordingSteps] = useState<FlowStep[]>([]);
  const [recordingName, setRecordingNameState] = useState("");
  const [recordingDescription, setRecordingDescriptionState] = useState("");
  const [recordingTags, setRecordingTags] = useState<string[]>([]);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

  const resetRecordingState = useCallback(() => {
    setIsRecording(false);
    setRecordingSteps([]);
    setRecordingNameState("");
    setRecordingDescriptionState("");
    setRecordingTags([]);
    setEditingFlowId(null);
  }, []);

  const startRecording = useCallback(() => {
    onStartRecording?.();
    resetRecordingState();
    setIsRecording(true);
  }, [onStartRecording, resetRecordingState]);

  const cancelRecording = useCallback(() => {
    resetRecordingState();
  }, [resetRecordingState]);

  const finalizeRecording = useCallback(() => {
    onFinalize({
      name: recordingName,
      description: recordingDescription,
      tags: recordingTags,
      steps: recordingSteps,
      editingFlowId,
    });
    resetRecordingState();
  }, [
    recordingName,
    recordingDescription,
    recordingTags,
    recordingSteps,
    editingFlowId,
    onFinalize,
    resetRecordingState,
  ]);

  const editFlow = useCallback((flow: Flow) => {
    setRecordingNameState(flow.name);
    setRecordingDescriptionState(flow.description ?? "");
    setRecordingTags([...(flow.tags ?? [])]);
    setRecordingSteps([...flow.steps]);
    setEditingFlowId(flow.id);
    setIsRecording(true);
    onStartRecording?.();
  }, [onStartRecording]);

  const onRecordNodeClick = useCallback((nodeId: string) => {
    setRecordingSteps((prev) => [...prev, { order: prev.length, componentId: nodeId }]);
  }, []);
  const onRecordEdgeClick = useCallback((edgeId: string, handleId?: string) => {
    setRecordingSteps((prev) => [...prev, { order: prev.length, connectionId: edgeId, handleId }]);
  }, []);
  const onRecordHandleClick = useCallback((nodeId: string, handleId: string) => {
    setRecordingSteps((prev) => [...prev, { order: prev.length, componentId: nodeId, handleId }]);
  }, []);
  const onRecordUndo = useCallback(() => {
    setRecordingSteps((prev) => prev.slice(0, -1));
  }, []);

  const setRecordingName = useCallback((name: string) => setRecordingNameState(name), []);
  const setRecordingDescription = useCallback((desc: string) => setRecordingDescriptionState(desc), []);

  const onAddTag = useCallback((tag: string) => {
    setRecordingTags((prev) => (prev.includes(tag) ? prev : [...prev, tag]));
  }, []);
  const onRemoveTag = useCallback((index: number) => {
    setRecordingTags((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const onUpdateStepDescription = useCallback((index: number, description: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, description } : s)));
  }, []);
  const onUpdateStepDuration = useCallback((index: number, duration: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, duration: duration || undefined } : s)));
  }, []);
  const onUpdateStepPayload = useCallback((index: number, payload: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, payload: payload || undefined } : s)));
  }, []);
  const onUpdateStepPayloadDirection = useCallback((index: number, direction: "request" | "response") => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, payloadDirection: direction } : s)));
  }, []);
  const onDeleteStep = useCallback((index: number) => {
    setRecordingSteps((prev) =>
      prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i }))
    );
  }, []);
  const onReorderSteps = useCallback((from: number, to: number) => {
    setRecordingSteps((prev) => {
      const n = [...prev];
      const [m] = n.splice(from, 1);
      n.splice(to, 0, m);
      return n.map((s, i) => ({ ...s, order: i }));
    });
  }, []);

  const value: RecordingModeState = {
    isRecording,
    recordingSteps,
    recordingName,
    recordingDescription,
    recordingTags,
    editingFlowId,
    setRecordingName,
    setRecordingDescription,
    onAddTag,
    onRemoveTag,
    onUpdateStepDescription,
    onUpdateStepDuration,
    onUpdateStepPayload,
    onUpdateStepPayloadDirection,
    onDeleteStep,
    onReorderSteps,
    onRecordNodeClick,
    onRecordEdgeClick,
    onRecordHandleClick,
    onRecordUndo,
    startRecording,
    cancelRecording,
    finalizeRecording,
    editFlow,
  };

  return <RecordingModeProvider value={value}>{children}</RecordingModeProvider>;
}
