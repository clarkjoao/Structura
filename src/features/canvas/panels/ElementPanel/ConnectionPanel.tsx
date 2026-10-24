import { useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, ArrowRight, Fingerprint, Spline } from "lucide-react";
import { toast } from "sonner";
import type { Connection, ConnectionIntent, ConnectionStyle } from "@/features/diagram";
import {
  EdgeStyle,
  StrokeStyle,
  EdgeMarker,
  useActiveDiagramId,
  useDiagramActions,
} from "@/features/diagram";
import { INTENT_DEFAULTS, useResolvedComponents } from "@/features/diagram";
import { cn } from "@/lib/utils";
import TechnologyCombobox from "./components/TechnologyCombobox";
import {
  AdvancedFooter,
  CommitField,
  PANEL_INPUT_CLASS,
  PANEL_LABEL_CLASS,
  PanelHeader,
  PanelSection,
} from "./shell";

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
  /** Select and frame an element — the endpoint names in the header call it. */
  onFocusElement?: (componentId: string) => void;
}

interface EndpointButtonProps {
  id: string;
  caption: string;
  onFocusElement?: (componentId: string) => void;
}

/** One end of the connection: its name, and the group it sits in as context. */
const EndpointButton = ({ id, caption, onFocusElement }: EndpointButtonProps) => {
  const { t } = useTranslation();
  const components = useResolvedComponents();
  const component = components[id];
  const parent = component?.parentId ? components[component.parentId] : undefined;
  const name = component?.name?.trim() || t("common.unnamedElement");
  return (
    <button
      type="button"
      disabled={!component || !onFocusElement}
      onClick={() => onFocusElement?.(id)}
      title={name}
      className="min-w-0 flex-1 rounded-md border border-border px-2 py-1.5 text-left enabled:hover:bg-accent disabled:cursor-default"
    >
      <span className="block text-[11px] text-muted-foreground">{caption}</span>
      <span className="block truncate text-sm font-medium">{name}</span>
      {parent && (
        <span className="block truncate text-xs text-muted-foreground">
          {t("common.inGroup", { name: parent.name?.trim() || t("common.unnamedElement") })}
        </span>
      )}
    </button>
  );
};

const ConnectionPanel = ({
  conn,
  onClose,
  updateConnection,
  removeConnection,
  focusTitleTrigger = 0,
  onFocusElement,
}: ConnectionPanelProps) => {
  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const { resetEdgeControlPoints, setEdgeLabelOffset } = useDiagramActions();
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
    <div className="flex min-h-0 flex-1 flex-col">
      <PanelHeader
        icon={<Spline className="h-3.5 w-3.5" />}
        typeLabel={t("common.connection")}
        name={conn.label}
        namePlaceholder={t("common.label")}
        onCommitName={(value) => applyPatch({ label: value })}
        nameInputRef={titleInputRef}
        menu={[
          {
            key: "copy-id",
            label: t("panelShell.copyId"),
            icon: Fingerprint,
            onSelect: () => {
              void navigator.clipboard?.writeText(conn.id);
              toast.success(t("panelShell.idCopied"));
            },
          },
          {
            key: "delete",
            label: t("connectionPanel.removeConnection"),
            icon: Trash2,
            destructive: true,
            separated: true,
            onSelect: () => {
              removeConnection(conn.id);
              onClose();
            },
          },
        ]}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PanelSection title={t("panelShell.sectionWhat")}>
          <div className="flex items-center gap-2">
            <EndpointButton
              id={conn.sourceId}
              caption={t("common.connectionFrom")}
              onFocusElement={onFocusElement}
            />
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            <EndpointButton
              id={conn.targetId}
              caption={t("common.connectionTo")}
              onFocusElement={onFocusElement}
            />
          </div>
          <div>
            <span className={PANEL_LABEL_CLASS}>{t("common.intent")}</span>
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
                            style: {
                              ...conn.style,
                              ...INTENT_DEFAULTS[p.value as ConnectionIntent],
                            },
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
            <span className={PANEL_LABEL_CLASS}>{t("common.direction")}</span>
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
            <span className={PANEL_LABEL_CLASS}>{t("connectionPanel.technologyLabel")}</span>
            <TechnologyCombobox
              value={conn.technology ?? ""}
              onSelect={(v) => applyPatch({ technology: v || undefined })}
            />
          </div>
          <div>
            <label htmlFor="connection-transport" className={PANEL_LABEL_CLASS}>
              {t("common.transportTypeTitle")}
            </label>
            <select
              id="connection-transport"
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
              className={PANEL_INPUT_CLASS}
            >
              <option value="">{t("common.none")}</option>
              <option value="sync">{t("common.transportSync")}</option>
              <option value="async">{t("common.transportAsync")}</option>
              <option value="event">{t("common.transportEvent")}</option>
              <option value="tcp">{t("common.transportTcp")}</option>
              <option value="udp">{t("common.transportUdp")}</option>
            </select>
          </div>
          <CommitField
            label={t("common.description")}
            value={conn.description ?? ""}
            multiline
            addLabel={t("panelShell.addDescription")}
            onCommit={(v) => applyPatch({ description: v || undefined })}
          />
        </PanelSection>
      </div>
      <AdvancedFooter id={conn.id} />
    </div>
  );
};

export default ConnectionPanel;
