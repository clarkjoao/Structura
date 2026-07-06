import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import debounce from "lodash.debounce";
import { X, Trash2, RotateCcw } from "lucide-react";
import type { Connection, ConnectionIntent, ConnectionStyle } from "@/features/diagram";
import {
  EdgeStyle,
  StrokeStyle,
  EdgeMarker,
  useActiveDiagramId,
  useDiagramActions,
  useEdgeControlPoints,
} from "@/features/diagram";
import { INTENT_DEFAULTS, saveLastEdgeStyle } from "@/features/diagram";
import { cn } from "@/lib/utils";
import { FIELD_DEBOUNCE_MS } from "@/features/canvas/canvas.constants";
import Field from "./components/Field";
import TechnologyCombobox from "./components/TechnologyCombobox";
import { VIBRANT_PRESETS } from "./components/colorPresets";

const TRANSPORT_PRESET_DEFAULTS: Record<
  NonNullable<Connection["transportPreset"]>,
  Partial<ConnectionStyle>
> = {
  sync: {
    edgeStyle: EdgeStyle.Straight,
    strokeStyle: StrokeStyle.Solid,
    markerEnd: EdgeMarker.ArrowClosed,
  },
  async: {
    edgeStyle: EdgeStyle.Straight,
    strokeStyle: StrokeStyle.Dashed,
    markerEnd: EdgeMarker.ArrowClosed,
  },
  event: {
    edgeStyle: EdgeStyle.Smoothstep,
    strokeStyle: StrokeStyle.Dashed,
    markerEnd: EdgeMarker.Arrow,
  },
  tcp: {
    edgeStyle: EdgeStyle.Straight,
    strokeStyle: StrokeStyle.Solid,
    markerEnd: EdgeMarker.Arrow,
  },
  udp: {
    edgeStyle: EdgeStyle.Straight,
    strokeStyle: StrokeStyle.Dotted,
    markerEnd: EdgeMarker.Arrow,
  },
};

type EdgeStyleOption = {
  value: EdgeStyle;
  label: string;
  icon: string;
};

const WIDTH_OPTIONS = [1, 2, 3] as const;

const EDGE_LABEL_OFFSET_CENTER = 0.5;

interface ConnectionPanelProps {
  conn: Connection;
  onClose: () => void;
  updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => void;
  removeConnection: (id: string) => void;
  focusTitleTrigger?: number;
}

const ConnectionPanel = ({
  conn,
  onClose,
  updateConnection,
  removeConnection,
  focusTitleTrigger = 0,
}: ConnectionPanelProps) => {
  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const { resetEdgeControlPoints, setEdgeLabelOffset } = useDiagramActions();
  const waypointCount = useEdgeControlPoints(conn.id).length;
  const [label, setLabel] = useState(conn.label);
  const [desc, setDesc] = useState(conn.description ?? "");
  const titleInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  const intentPills = useMemo(
    () =>
      [
        { value: "__custom__" as const, label: t("common.custom") },
        { value: "dependency" as const, label: t("common.dependency") },
        { value: "call" as const, label: t("common.call") },
        { value: "event" as const, label: t("common.event") },
        { value: "data-flow" as const, label: t("common.dataFlow") },
        { value: "async-message" as const, label: t("common.asyncMessage") },
      ] as { value: ConnectionIntent | "__custom__"; label: string }[],
    [t],
  );

  const directionPills = useMemo(
    () => [
      { value: "unidirectional" as const, label: t("common.unidirectional") },
      { value: "bidirectional" as const, label: t("common.bidirectional") },
      { value: "reverse" as const, label: t("common.reverse") },
    ],
    [t],
  );

  const edgeStyleOptions: EdgeStyleOption[] = useMemo(
    () => [
      { value: EdgeStyle.Straight, label: t("common.edgeStraight"), icon: "M 4 20 L 20 4" },
      { value: EdgeStyle.Bezier, label: t("common.edgeBezier"), icon: "M 4 20 C 4 4 20 4 20 4" },
      { value: EdgeStyle.Step, label: t("common.edgeStep"), icon: "M 4 20 H 12 V 4 H 20" },
      {
        value: EdgeStyle.Smoothstep,
        label: t("common.edgeSmoothstep"),
        icon: "M 4 20 C 12 20 12 4 20 4",
      },
      {
        value: EdgeStyle.Editable,
        label: t("common.edgeEditable"),
        icon: "M 4 20 Q 8 4 12 12 T 20 4",
      },
    ],
    [t],
  );

  const strokeOptions = useMemo(
    () => [
      { value: StrokeStyle.Solid, label: t("common.strokeSolid") },
      { value: StrokeStyle.Dashed, label: t("common.strokeDashed") },
      { value: StrokeStyle.Dotted, label: t("common.strokeDotted") },
    ],
    [t],
  );

  const markerOptions = useMemo(
    () => [
      { value: EdgeMarker.None, label: t("common.markerNone") },
      { value: EdgeMarker.Arrow, label: t("common.markerArrow") },
      { value: EdgeMarker.ArrowClosed, label: t("common.markerArrowClosed") },
    ],
    [t],
  );

  const debouncedUpdate = useMemo(
    () =>
      debounce((patch: Partial<Omit<Connection, "id">>) => {
        updateConnection(conn.id, patch);
      }, FIELD_DEBOUNCE_MS),
    [conn.id, updateConnection],
  );
  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);
  useEffect(() => {
    if (focusTitleTrigger > 0) {
      requestAnimationFrame(() => {
        const el = titleInputRef.current;
        if (el) {
          el.focus();
          el.select();
        }
      });
    }
  }, [focusTitleTrigger]);
  const applyPatch = (patch: Partial<Omit<Connection, "id">>) => updateConnection(conn.id, patch);
  const applyStyle = (stylePatch: Partial<ConnectionStyle>) =>
    applyPatch({ style: { ...conn.style, ...stylePatch } });
  const currentStyle = conn.style?.edgeStyle ?? EdgeStyle.Smoothstep;

  const resetEdgeLayout = () => {
    if (!activeDiagramId) return;
    resetEdgeControlPoints(activeDiagramId, conn.id);
    setEdgeLabelOffset(activeDiagramId, conn.id, EDGE_LABEL_OFFSET_CENTER);
  };

  const onUpdateEdgeStyle = (newStyle: EdgeStyleOption["value"]) => {
    const previousEdgeStyle = conn.style?.edgeStyle;
    if (previousEdgeStyle === newStyle) return;
    saveLastEdgeStyle(newStyle);
    updateConnection(conn.id, {
      style: {
        ...(conn.style ?? {}),
        edgeStyle: newStyle,
        waypoints: undefined,
      } as ConnectionStyle,
    });
    resetEdgeLayout();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full overflow-hidden">
      <div className="flex shrink-0 items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("common.connection")}
        </h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <Field
          label={t("common.label")}
          value={label}
          onChange={(v) => {
            setLabel(v);
            debouncedUpdate({ label: v });
          }}
          inputRef={titleInputRef}
        />
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            {t("common.edgeStyleSection")}
          </label>
          <div className="flex flex-wrap gap-2">
            {edgeStyleOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdateEdgeStyle(opt.value)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  currentStyle === opt.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d={opt.icon} />
                </svg>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            {t("common.intent")}
          </label>
          <div className="flex flex-wrap gap-1">
            {intentPills.map((p) => {
              const isCustom = p.value === "__custom__";
              const isSelected = isCustom
                ? conn.communicationType === "custom"
                : (conn.intent ?? "call") === p.value && conn.communicationType !== "custom";
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() =>
                    isCustom
                      ? applyPatch({ communicationType: "custom" })
                      : applyPatch({
                          intent: p.value as ConnectionIntent,
                          style: { ...conn.style, ...INTENT_DEFAULTS[p.value as ConnectionIntent] },
                          communicationType: "standard",
                        })
                  }
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            {t("common.direction")}
          </label>
          <div className="flex flex-wrap gap-1">
            {directionPills.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => applyPatch({ direction: p.value })}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  (conn.direction ?? "unidirectional") === p.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            {t("connectionPanel.technologyLabel")}
          </label>
          <TechnologyCombobox
            value={conn.technology ?? ""}
            onSelect={(v) => applyPatch({ technology: v || undefined })}
          />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
            {t("common.transportTypeTitle")}
          </label>
          <select
            value={conn.transportPreset ?? ""}
            onChange={(e) => {
              const v = e.target.value as Connection["transportPreset"] | "";
              if (!v) {
                applyPatch({ transportPreset: undefined });
                return;
              }
              const mergedStyle = {
                ...conn.style,
                ...TRANSPORT_PRESET_DEFAULTS[v],
              } as ConnectionStyle;
              const previousEdgeStyle = conn.style?.edgeStyle;
              applyPatch({ transportPreset: v, style: mergedStyle });
              if (previousEdgeStyle !== mergedStyle.edgeStyle) {
                resetEdgeLayout();
              }
            }}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">{t("common.none")}</option>
            <option value="sync">{t("common.transportSync")}</option>
            <option value="async">{t("common.transportAsync")}</option>
            <option value="event">{t("common.transportEvent")}</option>
            <option value="tcp">{t("common.transportTcp")}</option>
            <option value="udp">{t("common.transportUdp")}</option>
          </select>
        </div>
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
              {t("connectionPanel.colorLabel")}
            </label>
            <button
              type="button"
              onClick={() => applyStyle({ color: undefined })}
              className="text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("colorSwatches.default")}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {VIBRANT_PRESETS.map((preset) => {
              const isSelected = conn.style?.color === preset.color;
              return (
                <button
                  key={preset.color}
                  type="button"
                  onClick={() => applyStyle({ color: preset.color })}
                  title={t(preset.nameKey)}
                  className={cn(
                    "h-5 w-5 rounded-full border-2 transition-all hover:scale-110",
                    isSelected ? "scale-110 border-foreground" : "border-transparent",
                  )}
                  style={{ backgroundColor: preset.color }}
                />
              );
            })}
          </div>
        </div>
        {conn.communicationType === "custom" && (
          <div className="space-y-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mb-1">
              {t("connectionPanel.strokeLabel")}
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                value={conn.style?.strokeStyle ?? StrokeStyle.Solid}
                onChange={(e) => applyStyle({ strokeStyle: e.target.value as StrokeStyle })}
                className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
                title={t("common.strokeStyleTitle")}
              >
                {strokeOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                value={conn.style?.strokeWidth ?? 1}
                onChange={(e) => applyStyle({ strokeWidth: Number(e.target.value) as 1 | 2 | 3 })}
                className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
                title={t("common.strokeWidthTitle")}
              >
                {WIDTH_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}pt
                  </option>
                ))}
              </select>
            </div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium block mt-2 mb-1">
              {t("connectionPanel.markersLabel")}
            </label>
            <div className="flex flex-wrap gap-2">
              <select
                value={conn.style?.markerStart ?? EdgeMarker.None}
                onChange={(e) =>
                  applyStyle({
                    markerStart: (e.target.value === EdgeMarker.None
                      ? undefined
                      : e.target.value) as EdgeMarker | undefined,
                  })
                }
                className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
                title={t("common.markerStartTitle")}
              >
                {markerOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value === EdgeMarker.None
                      ? t("common.markerStartNone")
                      : t("common.markerStart", { label: o.label })}
                  </option>
                ))}
              </select>
              <select
                value={conn.style?.markerEnd ?? EdgeMarker.ArrowClosed}
                onChange={(e) => applyStyle({ markerEnd: e.target.value as EdgeMarker })}
                className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0"
                title={t("common.markerEndTitle")}
              >
                {markerOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.value === EdgeMarker.None
                      ? t("common.markerEndNone")
                      : t("common.markerEnd", { label: o.label })}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={conn.style?.animated ?? false}
                onChange={(e) => applyStyle({ animated: e.target.checked })}
                className="rounded border-border accent-primary"
              />
              {t("connectionPanel.animated")}
            </label>
          </div>
        )}
        <Field
          label={t("common.description")}
          value={desc}
          onChange={(v) => {
            setDesc(v);
            debouncedUpdate({ description: v || undefined });
          }}
          multiline
        />
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">
            {t("connectionPanel.idLabel")}
          </label>
          <p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">
            {conn.id}
          </p>
        </div>
        <div className="pt-2 space-y-2">
          <button
            type="button"
            onClick={resetEdgeLayout}
            disabled={waypointCount === 0}
            className="flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors w-full disabled:opacity-40 disabled:cursor-not-allowed text-muted-foreground hover:text-foreground hover:border-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {t("connectionPanel.resetPath")}
            {waypointCount > 0 && (
              <span className="ml-auto text-[10px] font-mono bg-muted rounded px-1 py-0.5 leading-none">
                {waypointCount}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              debouncedUpdate.cancel();
              removeConnection(conn.id);
              onClose();
            }}
            className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full"
          >
            <Trash2 className="h-3.5 w-3.5" /> {t("connectionPanel.removeConnection")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
