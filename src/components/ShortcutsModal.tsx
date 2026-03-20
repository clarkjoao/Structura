import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTranslation } from "react-i18next";

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </kbd>
  );
}

function ShortcutCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-secondary/30">
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{title}</p>
      </div>
      <div className="divide-y divide-border px-4">{children}</div>
    </section>
  );
}

function ShortcutRow({
  keys,
  label,
  description,
}: {
  keys: React.ReactNode;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="shrink-0 whitespace-nowrap">{keys}</div>
    </div>
  );
}

export default function ShortcutsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[760px] p-0 overflow-hidden rounded-2xl">
        <div className="border-b border-border px-6 py-5">
          <DialogHeader>
            <DialogTitle>{t("shortcutsModal.title")}</DialogTitle>
            <DialogDescription>
              {t("shortcutsModal.descriptionBeforeKbd")}{" "}
              <Kbd>Ctrl</Kbd> {t("shortcutsModal.descriptionAfterCtrl")} <Kbd>Cmd</Kbd>.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 py-5">
          <div className="grid gap-4 md:grid-cols-2">
            <ShortcutCard title={t("shortcutsModal.searchNav")}>
              <ShortcutRow
                label={t("shortcutsModal.searchCanvas")}
                description={t("shortcutsModal.searchCanvasDesc")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>F</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.searchAlt")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>/</Kbd>
                  </span>
                }
              />
            </ShortcutCard>

            <ShortcutCard title={t("shortcutsModal.selection")}>
              <ShortcutRow label={t("shortcutsModal.clearSelection")} keys={<Kbd>Esc</Kbd>} />
              <ShortcutRow
                label={t("shortcutsModal.selectAll")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>A</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.deleteSelected")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Del</Kbd>
                    <span className="text-muted-foreground">{t("common.or")}</span>
                    <Kbd>Backspace</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.undo")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>Z</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.redo")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>Shift</Kbd>
                    <Kbd>Z</Kbd>
                  </span>
                }
              />
            </ShortcutCard>

            <ShortcutCard title={t("shortcutsModal.clipboard")}>
              <ShortcutRow
                label={t("shortcutsModal.copy")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>C</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.paste")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>V</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.duplicate")}
                description={t("shortcutsModal.duplicateDesc")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>D</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.group")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>G</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.ungroup")}
                description={t("shortcutsModal.ungroupDesc")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>Shift</Kbd>
                    <Kbd>G</Kbd>
                  </span>
                }
              />
            </ShortcutCard>

            <ShortcutCard title={t("shortcutsModal.quickC4")}>
              <ShortcutRow
                label={t("shortcutsModal.quickInsertOpen")}
                description={t("shortcutsModal.quickInsertDesc")}
                keys={<Kbd>{t("shortcutsModal.rightClick")}</Kbd>}
              />
              <ShortcutRow
                label={t("shortcutsModal.addPerson")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>1</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.addSystem")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>2</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.addContainer")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>3</Kbd>
                  </span>
                }
              />
              <ShortcutRow
                label={t("shortcutsModal.addComponent")}
                keys={
                  <span className="inline-flex items-center gap-1">
                    <Kbd>Cmd/Ctrl</Kbd>
                    <Kbd>4</Kbd>
                  </span>
                }
              />
            </ShortcutCard>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

