import { createElement, useMemo, type ReactElement, type ReactNode } from "react";
import type { Diagram } from "@/features/diagram";
import { decodeShareParam, getShareParamFromUrl } from "@/lib/diagram-url";
import { ShareContext } from "../components/ShareContext";

interface ShareProviderProps {
  children: ReactNode;
}

export interface UseSharedDiagramResult {
  sharedDiagram: Diagram | null;
  ShareProvider: (props: ShareProviderProps) => ReactElement;
}

export function useSharedDiagram(): UseSharedDiagramResult {
  return useMemo(() => {
    const shareParam = getShareParamFromUrl();
    const sharedDiagram: Diagram | null = shareParam ? decodeShareParam(shareParam) : null;
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

    return { sharedDiagram, ShareProvider };
  }, []);
}
