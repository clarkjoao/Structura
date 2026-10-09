import {
  isPatternProvider,
  NEUTRAL_PROVIDER,
  type PatternProvider,
} from "@/features/elements/patterns";
import { useCanvasPreferencesStore } from "../preferences";

/**
 * The provider patterns are inserted with, remembered across sessions. A
 * stored family that is no longer registered reads as neutral.
 */
export function usePatternProvider(): [PatternProvider, (provider: PatternProvider) => void] {
  const stored = useCanvasPreferencesStore((state) => state.patternProvider);
  const setProvider = useCanvasPreferencesStore((state) => state.setPatternProvider);
  return [isPatternProvider(stored) ? stored : NEUTRAL_PROVIDER, setProvider];
}
