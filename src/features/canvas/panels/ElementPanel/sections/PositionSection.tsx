import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { NodeLayout } from "@/features/diagram";

const MIN_PANEL_WIDTH = 200;
const MIN_PANEL_HEIGHT = 150;
const DEBOUNCE_MS = 300;

export interface PositionSectionProps {
  componentId: string;
  nodeLayout: NodeLayout | undefined;
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => void;
  isPanel: boolean;
}

export function PositionSection({
  componentId,
  nodeLayout,
  updateNodeLayout,
  isPanel,
}: PositionSectionProps) {
  const { t } = useTranslation();
  const [xInput, setXInput] = useState("");
  const [yInput, setYInput] = useState("");
  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");

  useEffect(() => {
    if (!nodeLayout) {
      setXInput("");
      setYInput("");
      setWidthInput("");
      setHeightInput("");
      return;
    }
    setXInput(String(Math.round(nodeLayout.x)));
    setYInput(String(Math.round(nodeLayout.y)));
    setWidthInput(String(Math.round(nodeLayout.width ?? 0)));
    setHeightInput(String(Math.round(nodeLayout.height ?? 0)));
  }, [nodeLayout]);

  const commit = useCallback(() => {
    if (!nodeLayout) return;

    const trimmedX = xInput.trim();
    const trimmedY = yInput.trim();
    if (trimmedX === "" || trimmedY === "") return;

    const parsedX = Number(trimmedX);
    const parsedY = Number(trimmedY);
    if (!Number.isFinite(parsedX) || !Number.isFinite(parsedY)) return;

    const nextX = Math.round(parsedX);
    const nextY = Math.round(parsedY);

    if (isPanel) {
      const trimmedW = widthInput.trim();
      const trimmedH = heightInput.trim();
      if (trimmedW === "" || trimmedH === "") return;

      const parsedW = Number(trimmedW);
      const parsedH = Number(trimmedH);
      if (!Number.isFinite(parsedW) || !Number.isFinite(parsedH)) return;

      const nextW = Math.max(MIN_PANEL_WIDTH, Math.round(parsedW));
      const nextH = Math.max(MIN_PANEL_HEIGHT, Math.round(parsedH));

      if (
        nextX === nodeLayout.x &&
        nextY === nodeLayout.y &&
        nextW === nodeLayout.width &&
        nextH === nodeLayout.height
      ) {
        return;
      }

      updateNodeLayout(componentId, { x: nextX, y: nextY }, { width: nextW, height: nextH });
      return;
    }

    if (nextX === nodeLayout.x && nextY === nodeLayout.y) return;

    updateNodeLayout(componentId, { x: nextX, y: nextY });
  }, [componentId, heightInput, isPanel, nodeLayout, updateNodeLayout, widthInput, xInput, yInput]);

  useEffect(() => {
    if (!nodeLayout) return;

    const timeoutId = window.setTimeout(() => {
      commit();
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [commit, nodeLayout]);

  if (!nodeLayout) {
    return null;
  }

  const inputClassName =
    "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield]";

  return (
    <div className="space-y-2">
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
        {t("elementPanel.positionSection")}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("elementPanel.positionX")}
          </label>
          <input
            type="number"
            value={xInput}
            onChange={(event) => setXInput(event.target.value)}
            onBlur={commit}
            className={inputClassName}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("elementPanel.positionY")}
          </label>
          <input
            type="number"
            value={yInput}
            onChange={(event) => setYInput(event.target.value)}
            onBlur={commit}
            className={inputClassName}
          />
        </div>
      </div>
      {isPanel && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("elementPanel.positionW")}
            </label>
            <input
              type="number"
              min={MIN_PANEL_WIDTH}
              value={widthInput}
              onChange={(event) => setWidthInput(event.target.value)}
              onBlur={commit}
              className={inputClassName}
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("elementPanel.positionH")}
            </label>
            <input
              type="number"
              min={MIN_PANEL_HEIGHT}
              value={heightInput}
              onChange={(event) => setHeightInput(event.target.value)}
              onBlur={commit}
              className={inputClassName}
            />
          </div>
        </div>
      )}
    </div>
  );
}
