import { useState, useCallback, useMemo } from "react";
import type { Flow } from "@/features/diagram";
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
    setCurrentStepId((prevStepId) => {
      if (!prevStepId || !flow) return prevStepId;
      const step = getStepById(flow, prevStepId);
      if (!step?.next || isConditionStep(step)) return prevStepId;
      setHistory((prev) => [...prev, prevStepId]);
      return step.next;
    });
  }, [flow]);

  const chooseBranch = useCallback((branchIndex: number) => {
    setCurrentStepId((prevStepId) => {
      if (!prevStepId || !flow) return prevStepId;
      const step = getStepById(flow, prevStepId);
      if (!step?.branches?.[branchIndex]) return prevStepId;
      setHistory((prev) => [...prev, prevStepId]);
      return step.branches[branchIndex].nextId;
    });
  }, [flow]);

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const prevId = prev[prev.length - 1];
      setCurrentStepId(prevId);
      return prev.slice(0, -1);
    });
  }, []);

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
