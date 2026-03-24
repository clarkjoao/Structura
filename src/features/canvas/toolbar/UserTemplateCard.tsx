import { useEffect, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import type { UserTemplate } from "@/features/diagram";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PatternFlowPreview } from "./PatternFlowPreview";

export interface UserTemplateCardProps {
  template: UserTemplate;
  onInsert: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
}

export function UserTemplateCard({
  template,
  onInsert,
  onDelete,
  onRename,
}: UserTemplateCardProps) {
  const { t } = useTranslation();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(template.name);

  useEffect(() => {
    setDraftName(template.name);
  }, [template.id, template.name]);

  const handleDeleteClick = (): void => {
    const message = t("patterns.userTemplates.deleteConfirm", { name: template.name });
    if (typeof window !== "undefined" && window.confirm(message)) {
      onDelete();
    }
  };

  const commitRename = (): void => {
    const next = draftName.trim();
    if (next.length > 0 && next !== template.name) {
      onRename(next);
    } else {
      setDraftName(template.name);
    }
    setIsRenaming(false);
  };

  const handleInsertZoneClick = (): void => {
    if (isRenaming) return;
    onInsert();
  };

  const handleInsertZoneKeyDown = (event: KeyboardEvent): void => {
    if (isRenaming) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onInsert();
    }
  };

  return (
    <div className="flex rounded-lg border border-border bg-card hover:border-primary/40 transition-all overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        {isRenaming ? (
          <div className="px-3 pt-3 pb-1">
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitRename();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setDraftName(template.name);
                  setIsRenaming(false);
                }
              }}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
        ) : null}
        <div
          role="button"
          tabIndex={isRenaming ? -1 : 0}
          onClick={handleInsertZoneClick}
          onKeyDown={handleInsertZoneKeyDown}
          className="flex-1 min-w-0 text-left p-3 hover:bg-surface-hover transition-colors group outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {!isRenaming ? (
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                    {template.name}
                  </p>
                ) : null}
                {template.category ? (
                  <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                    {template.category}
                  </Badge>
                ) : null}
              </div>
              {template.description ? (
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                  {template.description}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                {t("patterns.elementAbbrev", { count: template.components.length })}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary rounded px-1.5 py-0.5">
                {t("patterns.connAbbrev", { count: template.connections.length })}
              </span>
            </div>
          </div>
          <PatternFlowPreview components={template.components} />
        </div>
      </div>
      <div className="shrink-0 flex flex-col gap-1 border-l border-border p-2 bg-muted/30">
        <button
          type="button"
          onClick={() => {
            setDraftName(template.name);
            setIsRenaming(true);
          }}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
          title={t("common.rename")}
          aria-label={t("common.rename")}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          title={t("patterns.userTemplates.delete")}
          aria-label={t("patterns.userTemplates.delete")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
