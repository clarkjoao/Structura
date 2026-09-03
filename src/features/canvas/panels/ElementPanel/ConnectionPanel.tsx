import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import debounce from "lodash.debounce";
import { X, Trash2 } from "lucide-react";
import type { Connection, ConnectionIntent, ConnectionStyle } from "@/features/diagram";
import {
  EdgeStyle,
  StrokeStyle,
  EdgeMarker,
  useActiveDiagramId,
  useDiagramActions,
} from "@/features/diagram";
import { INTENT_DEFAULTS } from "@/features/diagram";
import { cn } from "@/lib/utils";
import { FIELD_DEBOUNCE_MS } from "@/features/canvas/canvas.constants";
import Field from "./components/Field";
import TechnologyCombobox from "./components/TechnologyCombobox";

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
    edgeStyle: EdgeStyle.EditableStep,
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

  const resetEdgeLayout = () => {
    if (!activeDiagramId) return;
    resetEdgeControlPoints(activeDiagramId, conn.id);
    setEdgeLabelOffset(activeDiagramId, conn.id, EDGE_LABEL_OFFSET_CENTER);
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
