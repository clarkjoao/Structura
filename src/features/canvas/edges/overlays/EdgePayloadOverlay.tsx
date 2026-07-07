import { useTranslation } from "react-i18next";

export interface EdgePayloadOverlayProps {
  labelPoint: { x: number; y: number };
  labelOffsetY: number;
  payload: string;
  direction: "request" | "response";
}

export function EdgePayloadOverlay({
  labelPoint,
  labelOffsetY,
  payload,
  direction,
}: EdgePayloadOverlayProps) {
  const { t } = useTranslation();
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        transform: `translate(-50%, -50%) translate(${labelPoint.x}px, ${labelPoint.y + labelOffsetY}px)`,
      }}
    >
      <div
        className={`rounded-md border bg-card/95 backdrop-blur-sm px-2.5 py-1.5 shadow-lg min-w-[160px] max-w-[260px] ${
          direction === "response" ? "border-emerald-500/30" : "border-cyan-500/30"
        }`}
      >
        <div className="flex items-center gap-1 mb-1">
          <span
            className={`text-[9px] font-bold uppercase tracking-wider ${
              direction === "response" ? "text-emerald-400" : "text-cyan-400"
            }`}
          >
            {direction === "response" ? t("customEdge.response") : t("customEdge.request")}
          </span>
        </div>
        <pre className="text-[10px] font-mono text-foreground/90 whitespace-pre-wrap line-clamp-3 overflow-hidden">
          {payload}
        </pre>
      </div>
    </div>
  );
}
