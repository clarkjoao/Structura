import { useCollab } from "./CollabProvider";
import type { CollabUser } from "./types";

export interface CollabElementHighlight {
  color: string;
  userName: string;
}

export function useCollabHighlight(elementId: string | null): CollabElementHighlight | null {
  const { editingComponents } = useCollab();
  if (!elementId) return null;
  const user: CollabUser | undefined = editingComponents.get(elementId);
  if (!user) return null;
  return { color: user.color, userName: user.name };
}
