export function useCollabUrlParam() {
  const params = new URLSearchParams(window.location.search);
  const collab = params.get("collab");
  const collabDiagramId = collab ?? null;
  const isGuest = Boolean(collab);

  const generateCollabUrl = (diagramId: string): string => {
    return `${window.location.origin}/collab/${diagramId}`;
  };

  return { collabDiagramId, isGuest, generateCollabUrl };
}
