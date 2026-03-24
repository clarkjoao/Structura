import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useAllUserTemplates = () =>
  useDiagramStore(
    useShallow((state) =>
      [...Object.values(state.userTemplates)].sort((a, b) => b.createdAt - a.createdAt),
    ),
  );
