import { createElement, useMemo, type ReactElement, type ReactNode } from "react";
import type { Diagram } from "@/features/diagram/model";
import { EMPTY_READER_CATALOG, type ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import { decodeSharePayload, getFlowParamFromUrl, getShareParamFromUrl } from "@/lib/share-url";
import { ShareContext } from "../components/ShareContext";

interface ShareProviderProps {
  children: ReactNode;
}

export interface UseSharedDiagramResult {
  sharedDiagram: Diagram | null;
  /** The names the link carried beside the diagram — see `ReaderCatalog`. */
  sharedCatalog: ReaderCatalog;
  /** The script the link opened on, when it named one the diagram holds. */
  sharedFlowId: string | null;
  ShareProvider: (props: ShareProviderProps) => ReactElement;
}

export function useSharedDiagram(): UseSharedDiagramResult {
  return useMemo(() => {
    const shareParam = getShareParamFromUrl();
    // Read before the hash is cleared below; both live in it.
    const flowParam = getFlowParamFromUrl();
    const shared = shareParam ? decodeSharePayload(shareParam) : null;
    const sharedDiagram: Diagram | null = shared?.diagram ?? null;
    const sharedCatalog = shared?.catalog ?? EMPTY_READER_CATALOG;
    // Named, and actually there. A link outlives the script it points at.
    const sharedFlowId = flowParam && sharedDiagram?.snapshot.flows?.[flowParam] ? flowParam : null;
    if (shareParam) {
      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", cleanUrl);
    }

    function ShareProvider({ children }: ShareProviderProps): ReactElement {
      return createElement(
        ShareContext.Provider,
        {
          value: {
            sharedDiagram,
            clearShared: () => {},
          },
        },
        children,
      );
    }

    return { sharedDiagram, sharedCatalog, sharedFlowId, ShareProvider };
  }, []);
}
