import { createElement, useMemo, type ReactElement, type ReactNode } from "react";
import type { Diagram } from "@/features/diagram/model";
import { decodeShareParam, getFlowParamFromUrl, getShareParamFromUrl } from "@/lib/share-url";
import { ShareContext } from "../components/ShareContext";

interface ShareProviderProps {
  children: ReactNode;
}

export interface UseSharedDiagramResult {
  sharedDiagram: Diagram | null;
  /** The script the link opened on, when it named one the diagram holds. */
  sharedFlowId: string | null;
  ShareProvider: (props: ShareProviderProps) => ReactElement;
}

export function useSharedDiagram(): UseSharedDiagramResult {
  return useMemo(() => {
    const shareParam = getShareParamFromUrl();
    // Read before the hash is cleared below; both live in it.
    const flowParam = getFlowParamFromUrl();
    const sharedDiagram: Diagram | null = shareParam ? decodeShareParam(shareParam) : null;
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

    return { sharedDiagram, sharedFlowId, ShareProvider };
  }, []);
}
