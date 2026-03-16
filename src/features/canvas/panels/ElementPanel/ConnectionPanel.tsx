import { useState, useMemo, useEffect } from "react";
import debounce from "lodash.debounce";
import { X, Trash2 } from "lucide-react";
import type { Connection, ConnectionIntent, ConnectionDirection, EdgeStyle, StrokeStyle, EdgeMarker, ConnectionStyle } from "@/features/diagram";
import { INTENT_DEFAULTS } from "@/features/diagram";
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

const INTENT_PILLS: { value: ConnectionIntent | "__custom__"; label: string }[] = [
  { value: "__custom__", label: "Personalizado" }, { value: "dependency", label: "Dependência" },
  { value: "call", label: "Chamada" }, { value: "event", label: "Evento" },
  { value: "data-flow", label: "Fluxo" }, { value: "async-message", label: "Async" },
];

const DIRECTION_PILLS: { value: ConnectionDirection; label: string }[] = [
  { value: "unidirectional", label: "→ Unidirecional" }, { value: "bidirectional", label: "↔ Bidirecional" }, { value: "reverse", label: "← Reverso" },
];

const EDGE_STYLE_OPTIONS: { value: EdgeStyle; label: string }[] = [
  { value: "straight", label: "Reta" }, { value: "bezier", label: "Curva" }, { value: "step", label: "Step" }, { value: "smoothstep", label: "Suave" },
];
const STROKE_OPTIONS: { value: StrokeStyle; label: string }[] = [
  { value: "solid", label: "Sólida" }, { value: "dashed", label: "Tracejada" }, { value: "dotted", label: "Pontilhada" },
];
const WIDTH_OPTIONS = [1, 2, 3] as const;
const MARKER_OPTIONS: { value: EdgeMarker; label: string }[] = [
  { value: "none", label: "Nenhum" }, { value: "arrow", label: "Seta" }, { value: "arrowclosed", label: "Seta fechada" },
];

interface ConnectionPanelProps {
  conn: Connection;
  onClose: () => void;
  updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => void;
  removeConnection: (id: string) => void;
}

const ConnectionPanel = ({ conn, onClose, updateConnection, removeConnection }: ConnectionPanelProps) => {
  const [label, setLabel] = useState(conn.label);
  const [desc, setDesc] = useState(conn.description ?? "");
  const debouncedUpdate = useMemo(() => debounce((patch: Partial<Omit<Connection, "id">>) => { updateConnection(conn.id, patch); }, 300), [conn.id, updateConnection]);
  useEffect(() => () => debouncedUpdate.cancel(), [debouncedUpdate]);
  const applyPatch = (patch: Partial<Omit<Connection, "id">>) => updateConnection(conn.id, patch);
  const applyStyle = (stylePatch: Partial<ConnectionStyle>) =>
    applyPatch({ style: { ...conn.style, ...stylePatch } });

  return (
    <div className="flex flex-col w-80 h-full border-l border-border bg-card overflow-hidden">
      <div className="flex shrink-0 items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Conexão</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
        <Field label="Label" value={label} onChange={(v) => { setLabel(v); debouncedUpdate({ label: v }); }} />
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">Intenção</label>
          <div className="flex flex-wrap gap-1">
            {INTENT_PILLS.map((p) => {
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
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">Direção</label>
          <div className="flex flex-wrap gap-1">
            {DIRECTION_PILLS.map((p) => (
              <button key={p.value} type="button" onClick={() => applyPatch({ direction: p.value })}
                className={cn("rounded-full px-2.5 py-1 text-xs font-medium transition-colors", (conn.direction ?? "unidirectional") === p.value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground")}
              >{p.label}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">Tecnologia</label>
          <TechnologyCombobox value={conn.technology ?? ""} onSelect={(v) => applyPatch({ technology: v || undefined })} />
        </div>
        <div>
          <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">Tipo de transporte</label>
          <select value={conn.transportPreset ?? ""} onChange={(e) => { const v = e.target.value as Connection["transportPreset"] | ""; if (!v) { applyPatch({ transportPreset: undefined }); return; } applyPatch({ transportPreset: v, style: { ...conn.style, ...TRANSPORT_PRESET_DEFAULTS[v] } }); }}
            className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">Nenhum</option><option value="sync">Síncrono</option><option value="async">Assíncrono</option><option value="event">Evento</option><option value="tcp">TCP</option><option value="udp">UDP</option>
          </select>
        </div>
        {conn.communicationType === "custom" && (
          <div className="space-y-2">
            <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold block">Estilo da aresta</label>
            <div className="flex flex-wrap gap-2">
              <select value={conn.style?.edgeStyle ?? "straight"} onChange={(e) => applyStyle({ edgeStyle: e.target.value as EdgeStyle })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title="Tipo de linha">
                {EDGE_STYLE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              <select value={conn.style?.strokeStyle ?? "solid"} onChange={(e) => applyStyle({ strokeStyle: e.target.value as StrokeStyle })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title="Traço">
                {STROKE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
              </select>
              <select value={conn.style?.strokeWidth ?? 1} onChange={(e) => applyStyle({ strokeWidth: Number(e.target.value) as 1 | 2 | 3 })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title="Espessura">
                {WIDTH_OPTIONS.map((w) => (<option key={w} value={w}>{w}pt</option>))}
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={conn.style?.markerStart ?? "none"} onChange={(e) => applyStyle({ markerStart: (e.target.value === "none" ? undefined : e.target.value) as EdgeMarker | undefined })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title="Marcador início">
                {MARKER_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.value === "none" ? "Início: Nenhum" : `Início: ${o.label}`}</option>))}
              </select>
              <select value={conn.style?.markerEnd ?? "arrowclosed"} onChange={(e) => applyStyle({ markerEnd: e.target.value as EdgeMarker })} className="rounded-md border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring min-w-0" title="Marcador fim">
                {MARKER_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.value === "none" ? "Fim: Nenhum" : `Fim: ${o.label}`}</option>))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input type="checkbox" checked={conn.style?.animated ?? false} onChange={(e) => applyStyle({ animated: e.target.checked })} className="rounded border-border accent-primary" />Animado
            </label>
          </div>
        )}
        <Field label="Descrição" value={desc} onChange={(v) => { setDesc(v); debouncedUpdate({ description: v || undefined }); }} multiline />
        <div><label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1 block">ID</label><p className="text-xs font-mono text-muted-foreground bg-secondary rounded px-2 py-1.5">{conn.id}</p></div>
        <div className="pt-2">
          <button onClick={() => { debouncedUpdate.cancel(); removeConnection(conn.id); onClose(); }} className="flex items-center justify-center gap-1.5 rounded-md border border-destructive/30 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors w-full">
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConnectionPanel;
