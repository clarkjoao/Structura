import { useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, ArrowRightLeft, Fingerprint, Spline } from "lucide-react";
import { toast } from "sonner";
import type {
  Connection,
  ConnectionDirection,
  ConnectionInteraction,
  ConnectionKind,
} from "@/features/diagram";
import {
  resolveConnectionSemantics,
  useDiagramActions,
  useResolvedComponents,
} from "@/features/diagram";
import { cn } from "@/lib/utils";
import TechnologyCombobox from "./components/TechnologyCombobox";
import { AdvancedFooter, CommitField, PANEL_LABEL_CLASS, PanelHeader, PanelSection } from "./shell";

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

const INTERACTIONS: readonly ConnectionInteraction[] = ["sync", "async"];
const KINDS: readonly ConnectionKind[] = ["call", "event", "command", "dependency"];
const DIRECTIONS: readonly Exclude<ConnectionDirection, "reverse">[] = [
  "unidirectional",
  "bidirectional",
];

/** What a pill row is: one choice among a few, shown as chips. */
function ChoicePills<V extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: V; label: string }>;
  value: V | undefined;
  onChange: (value: V) => void;
}) {
  return (
    <div>
      <span className={PANEL_LABEL_CLASS}>{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              value === option.value
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

const ConnectionPanel = ({
  conn,
  onClose,
  updateConnection,
  removeConnection,
  focusTitleTrigger = 0,
  onFocusElement,
}: ConnectionPanelProps) => {
  const { t } = useTranslation();
  const { swapConnectionDirection } = useDiagramActions();
  const titleInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const semantics = resolveConnectionSemantics(conn);

  const interactionOptions = useMemo(
    () =>
      INTERACTIONS.map((value) => ({ value, label: t(`connectionPanel.interactions.${value}`) })),
    [t],
  );
  const kindOptions = useMemo(
    () => KINDS.map((value) => ({ value, label: t(`connectionPanel.kinds.${value}`) })),
    [t],
  );
  const directionOptions = useMemo(
    () => DIRECTIONS.map((value) => ({ value, label: t(`common.${value}`) })),
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

  /**
   * Writes the new vocabulary and retires the old: whatever the legacy intent said is carried
   * into `interaction` and `kind` first, so changing one does not lose the other.
   */
  const withSemantics = (patch: Partial<Pick<Connection, "interaction" | "kind">>) => ({
    interaction: semantics.interaction,
    kind: semantics.kind,
    ...patch,
    intent: undefined,
    transportPreset: undefined,
    communicationType: undefined,
  });

  const setInteraction = (interaction: ConnectionInteraction) => {
    // The interaction drives the stroke: drop what an earlier choice pinned on the edge.
    const style = conn.style && { ...conn.style };
    if (style) {
      delete style.strokeStyle;
      delete style.strokeWidth;
      delete style.animated;
    }
    applyPatch({
      ...withSemantics({ interaction }),
      style: style && Object.keys(style).length > 0 ? style : undefined,
    });
  };

  const swap = () => {
    if (!swapConnectionDirection(conn.id)) toast.error(t("connectionPanel.swapRefused"));
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
          <div className="flex items-center gap-1.5">
            <EndpointButton
              id={conn.sourceId}
              caption={t("common.connectionFrom")}
              onFocusElement={onFocusElement}
            />
            <button
              type="button"
              title={t("connectionPanel.swap")}
              aria-label={t("connectionPanel.swap")}
              onClick={swap}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </button>
            <EndpointButton
              id={conn.targetId}
              caption={t("common.connectionTo")}
              onFocusElement={onFocusElement}
            />
          </div>
          <ChoicePills
            label={t("connectionPanel.interaction")}
            options={interactionOptions}
            value={semantics.interaction}
            onChange={setInteraction}
          />
          <ChoicePills
            label={t("connectionPanel.kind")}
            options={kindOptions}
            value={semantics.kind}
            onChange={(kind) => applyPatch(withSemantics({ kind }))}
          />
          <ChoicePills
            label={t("common.direction")}
            options={directionOptions}
            value={conn.direction === "bidirectional" ? "bidirectional" : "unidirectional"}
            onChange={(direction) => applyPatch({ direction })}
          />
          <div>
            <span className={PANEL_LABEL_CLASS}>{t("connectionPanel.technologyTransport")}</span>
            <TechnologyCombobox
              value={conn.technology ?? ""}
              onSelect={(v) => applyPatch({ technology: v || undefined })}
            />
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
