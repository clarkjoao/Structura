import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useFolders = () => useDiagramStore(useShallow((s) => s.folders));

export const useAllFolders = () => useDiagramStore(useShallow((s) => Object.values(s.folders)));
