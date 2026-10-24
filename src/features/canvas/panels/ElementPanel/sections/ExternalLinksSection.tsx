import { useState, type ElementType } from "react";
import {
  BookMarked,
  GitBranch,
  Ticket,
  Link,
  X,
  ExternalLink as ExternalLinkIcon,
} from "lucide-react";
import { KEY, keyIs } from "@/lib/core/keyboard";
import { useTranslation } from "react-i18next";
import { ExternalLinkType } from "@/features/diagram";
import type { ExternalLink } from "@/features/diagram";
import { cn } from "@/lib/utils";
import { CommitField, PANEL_ADD_CLASS, PANEL_INPUT_CLASS, PANEL_LABEL_CLASS } from "../shell";

const TYPE_ICONS: Record<ExternalLinkType, ElementType> = {
  [ExternalLinkType.Confluence]: BookMarked,
  [ExternalLinkType.Github]: GitBranch,
  [ExternalLinkType.Jira]: Ticket,
  [ExternalLinkType.Generic]: Link,
};

const TYPE_LABEL_KEYS: Record<ExternalLinkType, string> = {
  [ExternalLinkType.Confluence]: "externalLinks.typeConfluence",
  [ExternalLinkType.Github]: "externalLinks.typeGithub",
  [ExternalLinkType.Jira]: "externalLinks.typeJira",
  [ExternalLinkType.Generic]: "externalLinks.typeGeneric",
};

const TYPES: readonly ExternalLinkType[] = [
  ExternalLinkType.Generic,
  ExternalLinkType.Confluence,
  ExternalLinkType.Github,
  ExternalLinkType.Jira,
];

export interface ExternalLinksSectionProps {
  componentId: string;
  links: ExternalLink[];
  onAdd: (link: Omit<ExternalLink, "id">) => void;
  onUpdate: (linkId: string, patch: Partial<Omit<ExternalLink, "id">>) => void;
  onRemove: (linkId: string) => void;
}

const EMPTY_FORM = { label: "", url: "", type: ExternalLinkType.Generic };

/** The link's kind as four icons: what it points at, at a glance, instead of a select. */
function TypePicker({
  value,
  onChange,
}: {
  value: ExternalLinkType;
  onChange: (type: ExternalLinkType) => void;
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t("externalLinks.typeField")} className="flex gap-1">
      {TYPES.map((type) => {
        const Icon = TYPE_ICONS[type];
        const label = t(TYPE_LABEL_KEYS[type]);
        return (
          <button
            key={type}
            type="button"
            role="radio"
            aria-checked={value === type}
            aria-label={label}
            title={label}
            onClick={() => onChange(type)}
            className={cn(
              "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-xs transition-colors",
              value === type
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-secondary text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}

export function ExternalLinksSection({
  componentId: _componentId,
  links,
  onAdd,
  onUpdate,
  onRemove,
}: ExternalLinksSectionProps) {
  const { t } = useTranslation();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const close = () => {
    setAdding(false);
    setForm(EMPTY_FORM);
  };

  const handleConfirmAdd = () => {
    if (!form.url.trim()) return;
    onAdd({ label: form.label.trim(), url: form.url.trim(), type: form.type });
    close();
  };

  const formKeys = (event: React.KeyboardEvent) => {
    if (keyIs(event, KEY.ENTER)) {
      event.preventDefault();
      handleConfirmAdd();
    } else if (keyIs(event, KEY.ESCAPE)) {
      event.stopPropagation();
      close();
    }
  };

  return (
    <div>
      <span className={PANEL_LABEL_CLASS}>{t("externalLinks.sectionTitle")}</span>

      <div className="space-y-0.5">
        {links.map((link) => {
          const Icon = TYPE_ICONS[link.type] ?? Link;
          const isExpanded = expandedId === link.id;
          return (
            <div key={link.id}>
              <div
                className="group flex h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-sm transition-colors hover:bg-secondary/60"
                onClick={() => setExpandedId(isExpanded ? null : link.id)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate text-foreground">{link.label || link.url}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("externalLinks.openLink")}
                  aria-label={t("externalLinks.openLink")}
                  onClick={(event) => event.stopPropagation()}
                  className="shrink-0 text-muted-foreground opacity-0 transition-all hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <ExternalLinkIcon className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(link.id);
                  }}
                  title={t("externalLinks.removeTitle")}
                  aria-label={t("externalLinks.removeTitle")}
                  className="shrink-0 text-muted-foreground opacity-0 transition-all hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {isExpanded && (
                <div className="ml-3.5 space-y-2 border-l-2 border-border py-1.5 pl-3">
                  <CommitField
                    label={t("externalLinks.labelField")}
                    value={link.label}
                    placeholder={t("externalLinks.labelPlaceholder")}
                    onCommit={(value) => onUpdate(link.id, { label: value })}
                  />
                  <CommitField
                    label={t("externalLinks.urlField")}
                    value={link.url}
                    mono
                    placeholder={t("externalLinks.urlPlaceholder")}
                    onCommit={(value) => onUpdate(link.id, { url: value })}
                  />
                  <div>
                    <span className={PANEL_LABEL_CLASS}>{t("externalLinks.typeField")}</span>
                    <TypePicker
                      value={link.type}
                      onChange={(type) => onUpdate(link.id, { type })}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-1.5 space-y-2 rounded-lg border border-border bg-secondary/30 p-2.5">
          <input
            autoFocus
            aria-label={t("externalLinks.labelField")}
            value={form.label}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, label: event.target.value }))
            }
            onKeyDown={formKeys}
            placeholder={t("externalLinks.labelPlaceholder")}
            className={PANEL_INPUT_CLASS}
          />
          <input
            aria-label={t("externalLinks.urlField")}
            value={form.url}
            onChange={(event) => setForm((previous) => ({ ...previous, url: event.target.value }))}
            onKeyDown={formKeys}
            placeholder={t("externalLinks.urlPlaceholder")}
            className={cn(PANEL_INPUT_CLASS, "font-mono")}
          />
          <TypePicker
            value={form.type}
            onChange={(type) => setForm((previous) => ({ ...previous, type }))}
          />
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={close}
              className="h-8 rounded-md border border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {t("externalLinks.cancelAdd")}
            </button>
            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={!form.url.trim()}
              className="h-8 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("externalLinks.confirmAdd")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className={cn(PANEL_ADD_CLASS, "mt-1.5")}
        >
          + {t("externalLinks.addButton")}
        </button>
      )}
    </div>
  );
}
