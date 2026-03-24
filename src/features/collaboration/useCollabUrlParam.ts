import { useEffect, useState } from "react";

export function useCollabUrlParam() {
  const [collabDiagramId, setCollabDiagramId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const collab = params.get("collab");
    if (collab) {
      setCollabDiagramId(collab);
      setIsGuest(true);
    }
  }, []);

  const generateCollabUrl = (diagramId: string): string => {
    const url = new URL(window.location.href);
    url.searchParams.set("collab", diagramId);
    return url.toString();
  };

  return { collabDiagramId, isGuest, generateCollabUrl };
}
