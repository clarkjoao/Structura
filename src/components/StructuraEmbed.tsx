import { useEffect, useRef } from "react";
import type { Diagram } from "@/features/diagram";

interface StructuraEmbedProps {
  diagram: Diagram;
  appOrigin: string;
  height?: number;
  width?: string | number;
  title?: string;
}

export function StructuraEmbed({
  diagram,
  appOrigin,
  height = 500,
  width = "100%",
  title = "Structura diagram",
}: StructuraEmbedProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const sendDiagram = () => {
      iframe.contentWindow?.postMessage(
        { type: "STRUCTURA_LOAD", diagram },
        appOrigin,
      );
    };

    iframe.addEventListener("load", sendDiagram);
    return () => iframe.removeEventListener("load", sendDiagram);
  }, [appOrigin, diagram]);

  return (
    <iframe
      ref={iframeRef}
      src={`${appOrigin}/embed`}
      width={width}
      height={height}
      frameBorder={0}
      title={title}
    />
  );
}
