import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import debounce from "lodash.debounce";
import { X, Trash2 } from "lucide-react";
import type { Connection, ConnectionIntent, ConnectionDirection, EdgeStyle, StrokeStyle, EdgeMarker, ConnectionStyle } from "@/features/diagram";
import { INTENT_DEFAULTS } from "@/features/diagram";
import { saveLastEdgeStyle } from "@/features/diagram/hooks/useLastEdgeStyle";
import { cn } from "@/lib/utils";
import Field from "./components/Field";
import TechnologyCombobox from "./components/TechnologyCombobox";

const TRANSPORT_PRESET_DEFAULTS: Record<NonNullable<Connection["transportPreset"]>, Partial<ConnectionStyle>> = {
  sync: { edgeStyle: "straight", strokeStyle: "solid", markerEnd: "arrowclosed" },
  async: { edgeStyle: "straight", strokeStyle: "dashed", markerEnd: "arrowclosed" },
  event: { edgeStyle: "smoothstep", strokeStyle: "dashed", markerEnd: "arrow" },
  tcp: { edgeStyle: "straight", strokeStyle: "solid", markerEnd: "arrow" },
  udp: { edgeStyle: "straight", strokeStyle: "dotted", markerEnd: "arrow" },
};

type EdgeStyleOption = {
  value: "straight" | "bezier" | "step" | "smoothstep";
  label: string;
  icon: string;
};

const WIDTH_OPTIONS = [1, 2, 3] as const;

interface ConnectionPanelProps {
  conn: Connection;
  onClose: () => void;
  updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => void;
  removeConnection: (id: string) => void;
  focusTitleTrigger?: number;
}

const ConnectionPanel = ({ conn, onClose, updateConnection, removeConnection, focusTitleTrigger = 0 }: ConnectionPanelProps) => {
  const { t } = useTranslation();
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
    () =>
      [
        { value: "unidirectional" as const, label: t("common.unidirectional") },
        { value: "bidirectional" as const, label: t("common.bidirectional") },
        { value: "reverse" as const, label: t("common.reverse") },
      ],
    [t],
  );

  const edgeStyleOptions: EdgeStyleOption[] = useMemo(
    () => [
      { value: "straight", label: t("common.edgeStraight"), icon: "M 4 20 L 20 4" },
      { value: "bezier", label: t("common.edgeBezier"), icon: "M 4 20 H 12 V 4 H 20" },
      { value: "step", label: t("common.edgeStep"), icon: "M 4 20 H 12 V 4 H 20" },
      { value: "smoothstep", label: t("common.edgeSmoothstep"), icon: "M 4 20 C 4 12 20 12 20 4" },
    ],
    [t],
  );

  const strokeOptions = useMemo(
    () =>
      [
        { value: "solid" as const, label: t("common.strokeSolid") },
        { value: "dashed" as const, label: t("common.strokeDashed") },
        { value: "dotted" as const, label: t("common.strokeDotted") },
      ],
    [t],
  );

  const markerOptions = useMemo(
    () =>
      [
        { value: "none" as const, label: t("common.markerNone") },
        { value: "arrow" as const, label: t("common.markerArrow") },
        { value: "arrowclosed" as const, label: t("common.markerArrowClosed") },
      ],
    [t],
  );

  const debouncedUpdate = useMemo(() => debounce((patch: Partial<Omit<Connection, "id">>) => { updateConnection(conn.id, patch); }, 300), [conn.id, updateConnection]);
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
  const currentStyle = conn.style?.edgeStyle ?? "smoothstep";
  const onUpdateEdgeStyle = (newStyle: EdgeStyleOption["value"]) => {
    saveLastEdgeStyle(newStyle);
    applyPatch({
      style: {
        ...(conn.style ?? {}),
        edgeStyle: newStyle,
        waypoints: undefined,
      } as ConnectionStyle,
    });
  };

  return (
    <div className="flex flex-col w-80 h-full border-l border-border bg-card overflow-hidden">
      <div className="flex shrink-0 items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t("common.connection")}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <Field label={t("common.label")} value={label} onChange={(v) => { setLabel(v); debouncedUpdate({ label: v }); }} inputRef={titleInputRef} />
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">{t("common.intent")}</label>
          <div className="flex flex-wrap gap-1">
            {intentPills.map((p) => {
              const isCustom = p.value === "__custom__";
              const isSelected = isCustom ? conn.communicationType === "custom" : (conn.intent ?? "call") === p.value && conn.communicationType !== "custom";
              return (
                <button key={p.value} type="button"
                  onClick={() => isCustom
                    ? applyPatch({ communicationType: "custom" })
                    : applyPatch({ intent: p.value as ConnectionIntent, style: { ...conn.style, ...INTENT_DEFAULTS[p.value as ConnectionIntent] }, communicationType: "standard" })}
                  className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", isSelected ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}
                >{p.label}</button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">{t("common.direction")}</label>
          <div className="flex flex-wrap gap-1">
            {directionPills.map((p) => (
              <button key={p.value} type="button" onClick={() => applyPatch({ direction: p.value })}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", (conn.direction ?? "unidirectional") === p.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}
              >{p.label}</button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("connectionPanel.lineStyle")}
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
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">{t("connectionPanel.technologyLabel")}</label>
          <TechnologyCombobox value={conn.technology ?? ""} onSelect={(v) => applyPatch({ technology: v || undefined })} />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">{t("common.transportTypeTitle")}</label>
          <select value={conn.transportPreset ?? ""} onChange={(e) => { const v = e.target.value as Connection["transportPreset"] | ""; if (!v) { applyPatch({ transportPreset: undefined }); return; } applyPatch({ transportPreset: v, style: { ...conn.style, ...TRANSPORT_PRESET_DEFAULTS[v] } }); }}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">{t("common.none")}</option>
            <option value="sync">{t("common.transportSync")}</option>
            <option value="async">{t("common.transportAsync")}</option>
            <option value="event">{t("common.transportEvent")}</option>
            <option value="tcp">{t("common.transportTcp")}</option>
            <option value="udp">{t("common.transportUdp")}</option>
          </select>
        </div>
        {conn.communicationType === "custom" && (
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">{t("common.edgeStyleSection")}</label>
            <div className="flex flex-wrap gap-2">
              <select value={conn.style?.edgeStyle ?? "straight"} onChange={(e) => applyStyle({ edgeStyle: e.target.value as EdgeStyle })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title={t("common.lineTypeTitle")}>
                {edgeStyleOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              <select value={conn.style?.strokeStyle ?? "solid"} onChange={(e) => applyStyle({ strokeStyle: e.target.value as StrokeStyle })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title={t("common.strokeStyleTitle")}>
                {strokeOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              <select value={conn.style?.strokeWidth ?? 1} onChange={(e) => applyStyle({ strokeWidth: Number(e.target.value) as 1 | 2 | 3 })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title={t("common.strokeWidthTitle")}>
                {WIDTH_OPTIONS.map((w) => (<option key={w} value={w}>{w}pt</option>))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={conn.style?.markerStart ?? "none"} onChange={(e) => applyStyle({ markerStart: (e.target.value === "none" ? undefined : e.target.value) as EdgeMarker | undefined })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title={t("common.markerStartTitle")}>
                {markerOptions.map((o) => (<option key={o.value} value={o.value}>{o.value === "none" ? t("common.markerStartNone") : t("common.markerStart", { label: o.label })}</option>))}
              </select>
              <select value={conn.style?.markerEnd ?? "arrowclosed"} onChange={(e) => applyStyle({ markerEnd: e.target.value as EdgeMarker })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title={t("common.markerEndTitle")}>
                {markerOptions.map((o) => (<option key={o.value} value={o.value}>{o.value === "none" ? t("common.markerEndNone") : t("common.markerEnd", { label: o.label })}</option>))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input type="checkbox" checked={conn.style?.animated ?? false} onChange={(e) => applyStyle({ animated: e.target.checked })} className="rounded border-border accent-primary" />{t("connectionPanel.animated")}
            </label>
          </div>
        )}
        <Field label={t("common.description")} value={desc} onChange={(v) => { setDesc(v); debouncedUpdate({ description: v || undefined }); }} multiline />
        <div><label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">{t("connectionPanel.idLabel")}</label><p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">{conn.id}</p></div>
        <div className="pt-2">
          <button onClick={() => { debouncedUpdate.cancel(); removeConnection(conn.id); onClose(); }} className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full">
            <Trash2 className="h-3.5 w-3.5" /> {t("connectionPanel.removeConnection")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
