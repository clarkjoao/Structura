import { memo, useMemo, useState } from "react";
import { ViewportPortal, useReactFlow, useStore } from "@xyflow/react";
import { Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Component, Connection } from "@/features/diagram";
import { EMPTY_SHARED_LAYER, buildSharedLayer, type SharedOriginal } from "./sharedLayerModel";
import { useSharedRevealStore } from "./useSharedRevealStore";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const NO_BOXES: Readonly<Record<string, Box>> = Object.freeze({});

/** The drawn boxes of the given nodes, absolute; re-renders only when one of them moves. */
function useBoxes(ids: readonly string[]): Readonly<Record<string, Box>> {
  return useStore(
    (state) => {
      if (ids.length === 0) return NO_BOXES;
      const boxes: Record<string, Box> = {};
      for (const id of ids) {
        const node = state.nodeLookup.get(id);
        if (!node || node.hidden || !node.measured.width) continue;
        const at = node.internals.positionAbsolute;
        boxes[id] = {
          x: at.x,
          y: at.y,
          width: node.measured.width ?? 0,
          height: node.measured.height ?? 0,
        };
      }
      return boxes;
    },
    (a, b) => {
      if (a === b) return true;
      const keys = Object.keys(a);
      if (keys.length !== Object.keys(b).length) return false;
      return keys.every((key) => {
        const p = a[key];
        const q = b[key];
        return !!q && p.x === q.x && p.y === q.y && p.width === q.width && p.height === q.height;
      });
    },
  );
}

const BADGE_H = 16;

export interface SharedLayerProps {
  components: Record<string, Component>;
  connections: Record<string, Connection>;
  /** What picking a badge does — the editor selects (or records) the original. */
  onPick?: (originalId: string) => void;
  /** Hint at elements worth sharing (the editor; a reader has nothing to change). */
  suggest?: boolean;
}

/**
 * The drawing of shared elements, over the canvas on both surfaces: the
 * `shared · N uses` chip on an original, the badge each consumer wears for a
 * badge-mode element (its name only), and on hover the original, its
 * references and its consumers lit, with who uses it by what protocol.
 *
 * Nothing here is a node and nothing is written; the edges stay in the model.
 */
export const SharedLayer = memo(function SharedLayer({
  components,
  connections,
  onPick,
  suggest = false,
}: SharedLayerProps) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const model = useMemo(() => buildSharedLayer(components, connections), [components, connections]);
  const boxes = useBoxes(model === EMPTY_SHARED_LAYER ? [] : model.anchorIds);
  const [hovered, setHovered] = useState<string | null>(null);

  if (model.originals.length === 0 && (!suggest || model.suggestions.size === 0)) return null;
  const byId = new Map(model.originals.map((original) => [original.id, original]));
  const active = hovered ? byId.get(hovered) : undefined;
  const goTo = (id: string) => {
    if (onPick) onPick(id);
    void fitView({ nodes: [{ id }], duration: 300, maxZoom: 1.2, padding: 0.4 });
  };
  const hover = {
    onMouseEnter: (id: string) => () => setHovered(id),
    onMouseLeave: () => setHovered(null),
  };

  const lit = active ? [active.id, ...active.refs, ...active.consumers.map((c) => c.id)] : [];

  return (
    <ViewportPortal>
      {lit.map((id) => {
        const box = boxes[id];
        if (!box) return null;
        return (
          <div
            key={`ring-${id}`}
            aria-hidden
            className="pointer-events-none absolute rounded-lg"
            style={{
              transform: `translate(${box.x - 4}px, ${box.y - 4}px)`,
              width: box.width + 8,
              height: box.height + 8,
              boxShadow: `0 0 0 2px ${active!.accent}`,
            }}
          />
        );
      })}

      {model.originals.map((original) => {
        const box = boxes[original.id];
        if (!box) return null;
        return (
          <button
            key={`chip-${original.id}`}
            type="button"
            data-testid="shared-chip"
            className="nodrag nopan absolute flex items-center gap-1 rounded-full px-1.5 font-mono text-[10px] leading-4"
            style={{
              transform: `translate(${box.x + box.width - 8}px, ${box.y - BADGE_H - 4}px) translateX(-100%)`,
              background: `color-mix(in srgb, ${original.accent} 10%, hsl(var(--card)))`,
              border: `1px solid color-mix(in srgb, ${original.accent} 40%, transparent)`,
              color: "hsl(var(--foreground))",
              pointerEvents: "all",
            }}
            onMouseEnter={hover.onMouseEnter(original.id)}
            onMouseLeave={hover.onMouseLeave}
            onClick={() => goTo(original.id)}
          >
            <Share2 size={10} strokeWidth={2} aria-hidden />
            {t("shared.chip")} · {t("shared.uses", { count: original.uses })}
          </button>
        );
      })}

      {[...model.badgesByConsumer.entries()].map(([consumerId, originalIds]) => {
        const box = boxes[consumerId];
        if (!box) return null;
        return (
          <div
            key={`badges-${consumerId}`}
            className="pointer-events-none absolute flex gap-1"
            style={{ transform: `translate(${box.x}px, ${box.y + box.height + 4}px)` }}
          >
            {originalIds.map((originalId) => {
              const original = byId.get(originalId)!;
              const protocols =
                original.consumers.find((c) => c.id === consumerId)?.protocols ?? [];
              return (
                <button
                  key={originalId}
                  type="button"
                  data-testid="shared-badge"
                  title={protocols.join(", ") || undefined}
                  className="nodrag nopan truncate rounded px-1.5 font-mono text-[10px]"
                  style={{
                    height: BADGE_H,
                    lineHeight: `${BADGE_H}px`,
                    maxWidth: box.width,
                    background: `color-mix(in srgb, ${original.accent} 10%, hsl(var(--card)))`,
                    border: `1px solid color-mix(in srgb, ${original.accent} 35%, transparent)`,
                    color: "hsl(var(--foreground))",
                    pointerEvents: "all",
                  }}
                  onMouseEnter={hover.onMouseEnter(originalId)}
                  onMouseLeave={hover.onMouseLeave}
                  onClick={() => goTo(originalId)}
                >
                  {original.name}
                </button>
              );
            })}
          </div>
        );
      })}

      {suggest &&
        [...model.suggestions.entries()].map(([id, count]) => {
          const box = boxes[id];
          if (!box) return null;
          // A hint only: it selects the element, whose bar holds the mode.
          return (
            <button
              key={`suggest-${id}`}
              type="button"
              data-testid="shared-suggestion"
              title={t("shared.suggest", { count })}
              aria-label={t("shared.suggest", { count })}
              className="nodrag nopan absolute flex h-4 w-4 items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-70 hover:opacity-100"
              style={{
                transform: `translate(${box.x + box.width - 6}px, ${box.y - 10}px)`,
                pointerEvents: "all",
              }}
              onClick={() => onPick?.(id)}
            >
              <Share2 size={9} strokeWidth={2} aria-hidden />
            </button>
          );
        })}

      {active && boxes[active.id] && (
        <UsedByPopover
          original={active}
          box={boxes[active.id]}
          onEnter={hover.onMouseEnter(active.id)}
          onLeave={hover.onMouseLeave}
          onGoTo={() => goTo(active.id)}
        />
      )}
    </ViewportPortal>
  );
});

function UsedByPopover({
  original,
  box,
  onEnter,
  onLeave,
  onGoTo,
}: {
  original: SharedOriginal;
  box: Box;
  onEnter: () => void;
  onLeave: () => void;
  onGoTo: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-label={t("shared.usedBy", { count: original.consumers.length })}
      data-testid="shared-popover"
      className="nodrag nopan nowheel absolute w-60 rounded-md border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg"
      style={{
        transform: `translate(${box.x + box.width + 12}px, ${box.y}px)`,
        pointerEvents: "all",
      }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <p className="mb-1 font-semibold">
        {t("shared.usedBy", { count: original.consumers.length })}
      </p>
      <ul className="mb-2 max-h-40 space-y-0.5 overflow-y-auto">
        {original.consumers.map((consumer) => (
          <li key={consumer.id} className="flex min-w-0 justify-between gap-2">
            <span className="truncate">{consumer.name}</span>
            <span className="shrink-0 truncate font-mono text-muted-foreground">
              {consumer.protocols.join(", ")}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        {original.mode === "badge" && <RevealButton original={original} />}
        <button
          type="button"
          className="rounded border border-border px-2 py-0.5 hover:bg-surface-hover"
          onClick={onGoTo}
        >
          {t("shared.goToOriginal")}
        </button>
      </div>
    </div>
  );
}

/** "Show the N edges": the hidden edges drawn again until pressed again. Never saved. */
function RevealButton({ original }: { original: SharedOriginal }) {
  const { t } = useTranslation();
  const revealed = useSharedRevealStore((state) => state.originals.has(original.id));
  const toggle = useSharedRevealStore((state) => state.toggleOriginal);
  const count = original.connectionIds.length;
  return (
    <button
      type="button"
      aria-pressed={revealed}
      className="rounded border border-border px-2 py-0.5 hover:bg-surface-hover"
      onClick={() => toggle(original.id)}
    >
      {revealed ? t("shared.hideEdges", { count }) : t("shared.showEdges", { count })}
    </button>
  );
}
