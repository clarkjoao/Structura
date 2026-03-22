import { useState, useCallback, useMemo } from "react";
import type { Flow, FlowStep } from "@/features/diagram";
import { getStepById, getEntryStep, isConditionStep } from "@/features/diagram";

export function useFlowPlaybackState(flow: Flow | null) {
  const [currentStepId, setCurrentStepId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);

  const currentStep = useMemo(
    () => (flow && currentStepId ? getStepById(flow, currentStepId) ?? null : null),
    [flow, currentStepId],
  );

  const isCondition = currentStep ? isConditionStep(currentStep) : false;
  const canGoBack = history.length > 0;
  const canGoForward = !!currentStep?.next && !isCondition;

  const start = useCallback(() => {
    if (!flow) return;
    const entry = getEntryStep(flow);
    setCurrentStepId(entry?.id ?? null);
    setHistory([]);
  }, [flow]);

  const goNext = useCallback(() => {
    if (!currentStep?.next || isCondition) return;
    setHistory((prev) => [...prev, currentStepId!]);
    setCurrentStepId(currentStep.next);
  }, [currentStep, currentStepId, isCondition]);

  const chooseBranch = useCallback((branchIndex: number) => {
    if (!currentStep?.branches?.[branchIndex]) return;
    setHistory((prev) => [...prev, currentStepId!]);
    setCurrentStepId(currentStep.branches[branchIndex].nextId);
  }, [currentStep, currentStepId]);

  const goBack = useCallback(() => {
    if (history.length === 0) return;
    const prevId = history[history.length - 1];
    setHistory((prev) => prev.slice(0, -1));
    setCurrentStepId(prevId);
  }, [history]);

  const exit = useCallback(() => {
    setCurrentStepId(null);
    setHistory([]);
  }, []);

  return {
    currentStepId,
    currentStep,
    isCondition,
    canGoBack,
    canGoForward,
    history,
    start,
    goNext,
    chooseBranch,
    goBack,
    exit,
  };
}
