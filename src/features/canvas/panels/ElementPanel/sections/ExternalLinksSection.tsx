import { useState, type ElementType } from "react";
import {
  BookMarked,
  GitBranch,
  Ticket,
  Link,
  X,
  Plus,
  ExternalLink as ExternalLinkIcon,
} from "lucide-react";
import { KEY, keyIs } from "@/lib/keyboard-utils";
import { useTranslation } from "react-i18next";
import { ExternalLinkType } from "@/features/diagram";
import type { ExternalLink } from "@/features/diagram";

const TYPE_ICONS: Record<ExternalLinkType, ElementType> = {
  [ExternalLinkType.Confluence]: BookMarked,
  [ExternalLinkType.Github]: GitBranch,
  [ExternalLinkType.Jira]: Ticket,
  [ExternalLinkType.Generic]: Link,
};

export interface ExternalLinksSectionProps {
  componentId: string;
  links: ExternalLink[];
  onAdd: (link: Omit<ExternalLink, "id">) => void;
  onUpdate: (linkId: string, patch: Partial<Omit<ExternalLink, "id">>) => void;
  onRemove: (linkId: string) => void;
}

const EMPTY_FORM = { label: "", url: "", type: ExternalLinkType.Generic };

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

  const handleConfirmAdd = () => {
    if (!form.url.trim()) return;
    onAdd({ label: form.label.trim(), url: form.url.trim(), type: form.type });
    setForm(EMPTY_FORM);
    setAdding(false);
  };

  return (
    <div>
      <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5 block">
        {t("externalLinks.sectionTitle")}
      </label>

      <div className="space-y-0.5">
        {links.map((link) => {
          const Icon = TYPE_ICONS[link.type] ?? Link;
          const isExpanded = expandedId === link.id;
          return (
            <div key={link.id}>
              <div
                className="group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : link.id)}
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1 text-foreground">{link.label || link.url}</span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={t("externalLinks.openLink")}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-all"
                >
                  <ExternalLinkIcon className="h-3 w-3" />
                </a>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemove(link.id);
                  }}
                  title={t("externalLinks.removeTitle")}
                  className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {isExpanded && (
                <div className="pl-5 pr-2 pb-2 pt-1 space-y-2 border-l-2 border-border ml-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">
                      {t("externalLinks.labelField")}
                    </label>
                    <input
                      value={link.label}
                      onChange={(event) => onUpdate(link.id, { label: event.target.value })}
                      onClick={(event) => event.stopPropagation()}
                      placeholder={t("externalLinks.labelPlaceholder")}
                      className="w-full rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">
                      {t("externalLinks.urlField")}
                    </label>
                    <input
                      value={link.url}
                      onChange={(event) => onUpdate(link.id, { url: event.target.value })}
                      onClick={(event) => event.stopPropagation()}
                      placeholder={t("externalLinks.urlPlaceholder")}
                      className="w-full rounded border border-border bg-secondary px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  <div onClick={(event) => event.stopPropagation()}>
                    <label className="text-[10px] text-muted-foreground block mb-0.5">
                      {t("externalLinks.typeField")}
                    </label>
                    <select
                      value={link.type}
                      onChange={(event) =>
                        onUpdate(link.id, { type: event.target.value as ExternalLinkType })
                      }
                      className="w-full rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value={ExternalLinkType.Confluence}>
                        {t("externalLinks.typeConfluence")}
                      </option>
                      <option value={ExternalLinkType.Github}>
                        {t("externalLinks.typeGithub")}
                      </option>
                      <option value={ExternalLinkType.Jira}>{t("externalLinks.typeJira")}</option>
                      <option value={ExternalLinkType.Generic}>
                        {t("externalLinks.typeGeneric")}
                      </option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {adding ? (
        <div className="mt-1.5 space-y-2 rounded-md border border-border bg-secondary/30 p-2">
          <input
            autoFocus
            value={form.label}
            onChange={(event) =>
              setForm((previous) => ({ ...previous, label: event.target.value }))
            }
            placeholder={t("externalLinks.labelPlaceholder")}
            className="w-full rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <input
            value={form.url}
            onChange={(event) => setForm((previous) => ({ ...previous, url: event.target.value }))}
            onKeyDown={(event) => {
              if (keyIs(event, KEY.ENTER)) handleConfirmAdd();
            }}
            placeholder={t("externalLinks.urlPlaceholder")}
            className="w-full rounded border border-border bg-secondary px-2 py-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <select
            value={form.type}
            onChange={(event) =>
              setForm((previous) => ({
                ...previous,
                type: event.target.value as ExternalLinkType,
              }))
            }
            className="w-full rounded border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value={ExternalLinkType.Confluence}>{t("externalLinks.typeConfluence")}</option>
            <option value={ExternalLinkType.Github}>{t("externalLinks.typeGithub")}</option>
            <option value={ExternalLinkType.Jira}>{t("externalLinks.typeJira")}</option>
            <option value={ExternalLinkType.Generic}>{t("externalLinks.typeGeneric")}</option>
          </select>
          <div className="flex gap-1.5 justify-end">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setForm(EMPTY_FORM);
              }}
              className="px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground border border-border rounded"
            >
              {t("externalLinks.cancelAdd")}
            </button>
            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={!form.url.trim()}
              className="px-2.5 py-1 text-[10px] font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {t("externalLinks.confirmAdd")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1.5 flex items-center justify-center gap-1.5 w-full rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("externalLinks.addButton")}
        </button>
      )}
    </div>
  );
}
