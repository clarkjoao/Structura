import { useCallback, useState } from "react";
import {
  appendRecentRef,
  readRecentRefs,
  writeRecentRefs,
  type RecentDiagramRef,
} from "@/features/diagram";



export function useRecentDiagrams() {
  const [recent, setRecent] = useState<RecentDiagramRef[]>(() => readRecentRefs());

  const recordOpened = useCallback((id: string) => {
    setRecent((prev) => {
      const next = appendRecentRef(prev, id);
      writeRecentRefs(next);
      return next;
    });
  }, []);

  const removeRecent = useCallback((id: string) => {
    setRecent((prev) => {
      const next = prev.filter((x) => x.id !== id);
      writeRecentRefs(next);
      return next;
    });
  }, []);

  return { recent, recordOpened, removeRecent };
}
