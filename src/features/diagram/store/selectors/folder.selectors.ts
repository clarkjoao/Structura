import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useFolderIds = () =>
  useDiagramStore(useShallow((s) => Object.keys(s.folders)));

export const useFolder = (id: string) =>
  useDiagramStore((s) => s.folders[id]);

export const useFolders = () => useDiagramStore((s) => s.folders);

export const useAllFolders = () =>
  useDiagramStore(
    useShallow((s) => Object.values(s.folders))
  );
