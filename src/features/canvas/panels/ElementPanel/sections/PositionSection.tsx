import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { NodeLayout } from "@/features/diagram";

const MIN_PANEL_WIDTH = 200;
const MIN_PANEL_HEIGHT = 150;

export interface PositionSectionProps {
  componentId: string;
  nodeLayout: NodeLayout | undefined;
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
    options?: { syncCanvas?: boolean },
  ) => void;
  /** When true, also expose width/height fields (panels, notes, svg, …). */
  isPanel: boolean;
  /** Floor for width when `isPanel`; defaults to panel min (200). */
  minWidth?: number;
  /** Floor for height when `isPanel`; defaults to panel min (150). */
  minHeight?: number;
}

export function PositionSection({
  componentId,
  nodeLayout,
  updateNodeLayout,
  isPanel,
  minWidth = MIN_PANEL_WIDTH,
  minHeight = MIN_PANEL_HEIGHT,
}: PositionSectionProps) {
  const { t } = useTranslation();
  const [xInput, setXInput] = useState("");
  const [yInput, setYInput] = useState("");
  const [widthInput, setWidthInput] = useState("");
  const [heightInput, setHeightInput] = useState("");
  /**
   * True while one of these fields has focus. The store is not the only writer of
   * a node's position -- a drag, the keyboard and the layout pass all move it --
   * so the fields follow the store, but never while the user is mid-edit.
   */
  const isEditingRef = useRef(false);

  useEffect(() => {
    if (!nodeLayout) {
      setXInput("");
      setYInput("");
      setWidthInput("");
      setHeightInput("");
      return;
    }
    if (isEditingRef.current) return;
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

      const nextW = Math.max(minWidth, Math.round(parsedW));
      const nextH = Math.max(minHeight, Math.round(parsedH));

      if (
        nextX === nodeLayout.x &&
        nextY === nodeLayout.y &&
        nextW === nodeLayout.width &&
        nextH === nodeLayout.height
      ) {
        return;
      }

      updateNodeLayout(
        componentId,
        { x: nextX, y: nextY },
        { width: nextW, height: nextH },
        { syncCanvas: true },
      );
      return;
    }

    if (nextX === nodeLayout.x && nextY === nodeLayout.y) return;

    updateNodeLayout(componentId, { x: nextX, y: nextY }, undefined, { syncCanvas: true });
  }, [
    componentId,
    heightInput,
    isPanel,
    minHeight,
    minWidth,
    nodeLayout,
    updateNodeLayout,
    widthInput,
    xInput,
    yInput,
  ]);

  /**
   * Position is committed only from a real edit -- blur or Enter. This used to run
   * on a 300ms timer re-armed by every `nodeLayout` identity change, which meant a
   * drag made the panel write the rounded position straight back to the store. That
   * write and the ResizeObserver layout write then re-triggered each other, and the
   * node oscillated between its dragged and original position for as long as the
   * panel stayed open. Measured 2026-09-13; see docs/epico-virtualizacao/.
   */
  const handleFocus = useCallback(() => {
    isEditingRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isEditingRef.current = false;
    commit();
  }, [commit]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return;
      commit();
    },
    [commit],
  );

  if (!nodeLayout) {
    return null;
  }

  const inputClassName =
    "w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield]";

  // Generate stable IDs for label-input associations
  const xInputId = `position-x-${componentId}`;
  const yInputId = `position-y-${componentId}`;
  const widthInputId = `position-width-${componentId}`;
  const heightInputId = `position-height-${componentId}`;

  return (
    <div className="space-y-2">
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
        {t("elementPanel.positionSection")}
      </label>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={xInputId} className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("elementPanel.positionX")}
          </label>
          <input
            id={xInputId}
            type="number"
            value={xInput}
            onChange={(event) => setXInput(event.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            aria-describedby={`${xInputId}-hint`}
            className={inputClassName}
          />
          <span id={`${xInputId}-hint`} className="sr-only">
            {t("elementPanel.positionXHint")}
          </span>
        </div>
        <div>
          <label htmlFor={yInputId} className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("elementPanel.positionY")}
          </label>
          <input
            id={yInputId}
            type="number"
            value={yInput}
            onChange={(event) => setYInput(event.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            aria-describedby={`${yInputId}-hint`}
            className={inputClassName}
          />
          <span id={`${yInputId}-hint`} className="sr-only">
            {t("elementPanel.positionYHint")}
          </span>
        </div>
      </div>
      {isPanel && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor={widthInputId} className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("elementPanel.positionW")}
            </label>
            <input
              id={widthInputId}
              type="number"
              min={minWidth}
              value={widthInput}
              onChange={(event) => setWidthInput(event.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              aria-describedby={`${widthInputId}-hint`}
              className={inputClassName}
            />
            <span id={`${widthInputId}-hint`} className="sr-only">
              {t("elementPanel.positionWidthHint", { min: minWidth })}
            </span>
          </div>
          <div>
            <label htmlFor={heightInputId} className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
              {t("elementPanel.positionH")}
            </label>
            <input
              id={heightInputId}
              type="number"
              min={minHeight}
              value={heightInput}
              onChange={(event) => setHeightInput(event.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              aria-describedby={`${heightInputId}-hint`}
              className={inputClassName}
            />
            <span id={`${heightInputId}-hint`} className="sr-only">
              {t("elementPanel.positionHeightHint", { min: minHeight })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
